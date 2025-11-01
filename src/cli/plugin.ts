import { Command } from 'commander'
import path from 'path'
import fs from 'fs'
import fsP from 'fs/promises'
import { PluginManifest } from 'src/preload/plugin'
import AdmZip from 'adm-zip'
import os from 'os'
import axios from 'axios'

interface UploadOptions {
  accessKey?: string
  accessSecret?: string
}

interface UserInfo {
  name: string
  email?: string
  sub?: string
  // Add other OIDC standard fields as needed
}

/**
 * Create a zip file containing manifest.json and dist folder
 */
async function createPluginZip(pluginDir: string, manifest: PluginManifest): Promise<string> {
  const zip = new AdmZip()

  // Add manifest.json
  const manifestPath = path.join(pluginDir, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    zip.addLocalFile(manifestPath)
  } else {
    throw new Error('manifest.json not found')
  }

  // Add dist folder
  const distPath = path.join(pluginDir, 'dist')
  if (fs.existsSync(distPath)) {
    zip.addLocalFolder(distPath, 'dist')
  } else {
    throw new Error('dist folder not found')
  }

  // Add extra files or folders from manifest.files
  if (Array.isArray((manifest as any).files) && (manifest as any).files.length > 0) {
    for (const rawEntry of (manifest as any).files as string[]) {
      if (!rawEntry || typeof rawEntry !== 'string') continue

      // Resolve to absolute path; support relative to pluginDir
      const entryPath = path.isAbsolute(rawEntry) ? rawEntry : path.join(pluginDir, rawEntry)

      if (!fs.existsSync(entryPath)) {
        sysLog.warn(`Extra file not found, skip: ${entryPath}`)
        continue
      }

      const stat = fs.statSync(entryPath)

      // Compute target path inside zip: preserve path relative to pluginDir
      const relativeToRoot = path.relative(pluginDir, entryPath)
      const destPathInZip = relativeToRoot.replace(/\\/g, '/')

      if (stat.isDirectory()) {
        zip.addLocalFolder(entryPath, destPathInZip)
      } else if (stat.isFile()) {
        // Ensure folder structure by specifying a target path
        zip.addLocalFile(
          entryPath,
          path.dirname(destPathInZip) === '.' ? '' : path.dirname(destPathInZip)
        )
      } else {
        sysLog.warn(`Unsupported extra path type, skip: ${entryPath}`)
      }
    }
  }

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), 'ecubus-plugin-upload')
  if (!fs.existsSync(tempDir)) {
    await fsP.mkdir(tempDir, { recursive: true })
  }

  // Generate zip file name
  const zipFileName = `${manifest.id}.zip`
  const zipFilePath = path.join(tempDir, zipFileName)

  // Write zip file
  zip.writeZip(zipFilePath)

  sysLog.debug(`Created zip file: ${zipFilePath}`)
  return zipFilePath
}

/**
 * Clean up temporary files
 */
async function cleanupTempFiles(tempDir?: string): Promise<void> {
  if (!tempDir) {
    tempDir = path.join(os.tmpdir(), 'ecubus-plugin-upload')
  }

  if (fs.existsSync(tempDir)) {
    await fsP.rm(tempDir, { recursive: true, force: true })
    sysLog.debug('Cleaned up temporary files')
  }
}

/**
 * Get user information from the API according to OIDC standards
 */
async function getUserInfo(options: UploadOptions): Promise<UserInfo> {
  const userinfoEndpoint = `https://door.whyengineer.com/api/user?accessKey=${options.accessKey}&accessSecret=${options.accessSecret}`

  try {
    const response = await axios.get(userinfoEndpoint)
    const userInfo = response.data

    if (!userInfo.name) {
      throw new Error('User info does not contain name field')
    }

    return userInfo
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Failed to get user info: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`
      )
    }
    throw new Error(`Failed to get user info: ${error.message}`)
  }
}

/**
 * Delete a resource by calling local server API
 * Returns true if deleted or not found (404), throws error if permission denied (403)
 */
async function deleteResource(resourceId: string, options: UploadOptions): Promise<boolean> {
  const deleteEndpoint = 'https://app.whyengineer.com/resources/api/delete-resource'

  try {
    const response = await axios.post(deleteEndpoint, {
      accessKey: options.accessKey,
      accessSecret: options.accessSecret,
      resourceId: resourceId
    })

    const result = response.data

    if (result.status === 'ok') {
      sysLog.debug('Resource deleted successfully')
      return true
    } else {
      throw new Error(`API error: ${result.msg || 'Unknown error'}`)
    }
  } catch (error: any) {
    // Handle 404 - resource doesn't exist, that's fine
    if (error.response && error.response.status === 404) {
      sysLog.debug('Resource not found (404), skipping delete')
      return false
    }

    // Handle 403 - permission denied, throw error
    if (error.response && error.response.status === 403) {
      const errorMsg =
        error.response.data?.msg || 'Permission denied: Resource belongs to another user'
      throw new Error(errorMsg)
    }

    // Other errors
    if (error.response) {
      throw new Error(
        `Failed to delete resource: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`
      )
    }
    throw new Error(`Failed to delete resource: ${error.message}`)
  }
}

/**
 * Upload a single resource file to the API
 */
async function uploadResource(
  file: string,
  username: string,
  options: UploadOptions,
  manifest: PluginManifest,
  type: 'image' | 'readme' | 'zip' | 'json'
): Promise<any> {
  const uploadEndpoint = `https://door.whyengineer.com/api/upload-resource?accessKey=${options.accessKey}&accessSecret=${options.accessSecret}`

  const ext = path.extname(file)
  // Construct resource ID (owner/name format)
  const resourceId = `ecubus//resources/plugins/${manifest.id}/${type}${ext}`

  // Try to delete existing resource before upload
  // - If 404: resource doesn't exist, continue
  // - If 403: permission denied (belongs to another user), throw error
  // - If success: resource deleted, continue
  try {
    sysLog.debug(`Attempting to delete existing resource: ${resourceId}`)
    const deleted = await deleteResource(resourceId, options)
    if (deleted) {
      sysLog.debug('Existing resource deleted successfully')
    } else {
      sysLog.debug('No existing resource found, proceeding with upload')
    }
  } catch (error: any) {
    // If it's a permission denied error (403), re-throw it to stop the upload
    if (error.message.includes('Permission denied')) {
      throw new Error(`Cannot upload plugin '${manifest.id}': ${error.message}`)
    }
    // For other errors, log and continue (might be network issues, etc.)
    sysLog.warn(`Warning during resource deletion: ${error.message}`)
  }

  // Read file content
  const fileBuffer = await fsP.readFile(file)
  const fileName = path.basename(file)

  // Create FormData with native API
  const formData = new FormData()

  // Create a Blob from the buffer - convert to Uint8Array first for type compatibility
  const fileBlob = new Blob([new Uint8Array(fileBuffer)])
  formData.append('file', fileBlob, fileName)

  //   // Add metadata
  formData.append('owner', 'ecubus')
  formData.append('user', username)
  formData.append('application', 'app-built-in')
  formData.append('tag', manifest.version)
  formData.append('parent', manifest.id)

  formData.append('fullFilePath', `plugins/${manifest.id}/${type}${ext}`)

  if (type === 'json') {
    formData.append(
      'description',
      JSON.stringify({
        name: manifest.name,
        description: manifest.description,
        author: username
      })
    )
  }

  try {
    const response = await axios.post(uploadEndpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    const result = response.data

    // Check if the API returned an error status
    if (result.status === 'error') {
      throw new Error(`API error: ${result.msg || 'Unknown error'}`)
    }

    return result
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Upload failed: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`
      )
    }
    throw new Error(`Upload failed: ${error.message}`)
  }
}

/**
 * Upload a complete plugin package with image, readme, and zip
 */
export async function pluginMain(pluginDir: string, options: UploadOptions): Promise<void> {
  if (!options.accessKey) {
    options.accessKey = process.env.ECUBUS_ACCESS_KEY
  }
  if (!options.accessSecret) {
    options.accessSecret = process.env.ECUBUS_ACCESS_SECRET
  }
  if (!options.accessKey || !options.accessSecret) {
    throw new Error('Access key and access secret are required')
  }

  if (!path.isAbsolute(pluginDir)) {
    pluginDir = path.join(process.cwd(), pluginDir)
  }

  if (!fs.existsSync(pluginDir)) {
    throw new Error(`Plugin directory ${pluginDir} not found`)
  }

  // Read manifest.json
  const manifestPath = path.join(pluginDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${pluginDir}`)
  }

  const manifestContent = await fsP.readFile(manifestPath, 'utf-8')
  const manifest: PluginManifest = JSON.parse(manifestContent)

  sysLog.info(`📦 Uploading plugin: ${manifest.name} (${manifest.id}) v${manifest.version}`)

  let zipFilePath: string | null = null

  try {
    // Get user information first
    sysLog.debug('Getting user information...')
    const userInfo = await getUserInfo(options)
    sysLog.info(`Logged in as: ${userInfo.name}`)
    if (manifest.author != userInfo.name) {
      throw new Error(`Plugin author ${manifest.author} does not match user ${userInfo.name}`)
    }

    // Clean up old temp files first
    await cleanupTempFiles()

    // Validate required files
    let imagePath: string = manifest.icon
    let readmePath: string = manifest.readme

    if (!path.isAbsolute(imagePath)) {
      imagePath = path.join(pluginDir, imagePath)
    }

    if (!path.isAbsolute(readmePath)) {
      readmePath = path.join(pluginDir, readmePath)
    }

    // Check if files exist
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Icon file not found: ${imagePath}`)
    }
    if (!fs.existsSync(readmePath)) {
      throw new Error(`Readme file not found: ${readmePath}`)
    }

    // 1. Create zip file
    sysLog.debug('Creating plugin zip file...')
    zipFilePath = await createPluginZip(pluginDir, manifest)
    sysLog.debug('Zip file created')

    // 2. Upload zip file
    sysLog.info('Uploading zip file...')
    const zipResult = await uploadResource(zipFilePath, userInfo.name, options, manifest, 'zip')
    sysLog.debug(zipResult)
    sysLog.info('✓ Zip uploaded successfully')

    // 3. Upload image
    sysLog.info('Uploading image...')
    await uploadResource(imagePath, userInfo.name, options, manifest, 'image')
    sysLog.info('✓ Image uploaded successfully')

    // 4. Upload readme
    sysLog.info('Uploading readme...')
    await uploadResource(readmePath, userInfo.name, options, manifest, 'readme')
    sysLog.info('✓ Readme uploaded successfully')

    // 5. Upload manifest.json
    sysLog.info('Uploading manifest.json...')
    await uploadResource(manifestPath, userInfo.name, options, manifest, 'json')
    sysLog.info('✓ Manifest.json uploaded successfully')
  } catch (error) {
    // Clean up on error
    await cleanupTempFiles()
    throw error
  } finally {
    // Always clean up temp files
    await cleanupTempFiles()
  }
}
