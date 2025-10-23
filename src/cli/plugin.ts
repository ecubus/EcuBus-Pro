import { Command } from 'commander'
import path from 'path'
import fs from 'fs'
import fsP from 'fs/promises'
import { PluginManifest } from 'src/preload/plugin'
import AdmZip from 'adm-zip'
import os from 'os'

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
    const response = await fetch(userinfoEndpoint, {
      method: 'GET'
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to get user info: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const userInfo = await response.json()

    if (!userInfo.name) {
      throw new Error('User info does not contain name field')
    }

    return userInfo
  } catch (error: any) {
    throw new Error(`Failed to get user info: ${error.message}`)
  }
}

/**
 * Check if a resource already exists
 * Returns the resource data if it exists, null otherwise
 */
async function checkResource(resourceId: string, options: UploadOptions): Promise<any | null> {
  const getResourceEndpoint = `https://door.whyengineer.com/api/get-resource?id=${encodeURIComponent(resourceId)}&accessKey=${options.accessKey}&accessSecret=${options.accessSecret}`

  try {
    const response = await fetch(getResourceEndpoint, {
      method: 'GET'
    })

    if (!response.ok) {
      // If 404, resource doesn't exist
      if (response.status === 404) {
        return null
      }
      const errorText = await response.text()
      throw new Error(
        `Failed to check resource: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const result = await response.json()

    // Check if the API returned an error status
    if (result.status === 'error') {
      // If the error is "not found", return null
      if (result.msg && result.msg.toLowerCase().includes('not found')) {
        return null
      }
      throw new Error(`API error: ${result.msg || 'Unknown error'}`)
    }

    return result
  } catch (error: any) {
    // If error is about not found, return null
    if (error.message.includes('not found') || error.message.includes('404')) {
      return null
    }
    throw error
  }
}

/**
 * Delete a resource
 */
async function deleteResource(params: any, options: UploadOptions): Promise<void> {
  const deleteEndpoint = `https://door.whyengineer.com/api/delete-resource?accessKey=${options.accessKey}&accessSecret=${options.accessSecret}`

  try {
    const response = await fetch(deleteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        owner: 'ecubus',
        name: '/resources/plugins/app-template/zip',
        createdTime: '2025-10-23T14:53:54Z',
        user: 'frankie',
        provider: 'oss',
        application: 'app-built-in',
        tag: '1.0.0',
        parent: 'app-template',
        fileName: 'zip',
        fileType: '',
        fileFormat: '',
        fileSize: 12025,
        url: 'https://ecubus.oss-cn-chengdu.aliyuncs.com/resources/plugins/app-template/zip',
        description: ''
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to delete resource: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const result = await response.json()
    sysLog.debug(result)
    // Check if the API returned an error status
    if (result.status === 'error') {
      throw new Error(`API error: ${result.msg || 'Unknown error'}`)
    }
  } catch (error: any) {
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

  // Construct resource ID (owner/name format)
  const resourceId = `ecubus//plugins/${manifest.id}/${type}`

  // Check if resource already exists
  sysLog.debug(`Checking if resource exists: ${resourceId}`)
  //   const existingResource = await checkResource(resourceId, options)
  const existingResource = true

  if (existingResource) {
    // Extract user from existing resource
    // const existingUser = existingResource.data?.user || existingResource.user

    // if (existingUser && existingUser !== username) {
    //   throw new Error(
    //     `ID '${manifest.id}' already exists and belongs to another user`
    //   )
    // }

    // Same user, delete the existing resource
    sysLog.debug(`Resource exists, deleting before upload...`)
    await deleteResource(resourceId, options)
  }

  // Read file content
  const fileBuffer = await fsP.readFile(file)
  const fileName = path.basename(file)
  const ext = path.extname(file)

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

  if (type === 'json' && manifest.description) {
    formData.append('description', manifest.description)
  }

  try {
    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    // Only call response.json() once, as the body can only be read once
    const result = await response.json()

    // Check if the API returned an error status
    if (result.status === 'error') {
      throw new Error(`API error: ${result.msg || 'Unknown error'}`)
    }

    return result
  } catch (error: any) {
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
  } catch (error) {
    // Clean up on error
    await cleanupTempFiles()
    throw error
  } finally {
    // Always clean up temp files
    await cleanupTempFiles()
  }
}
