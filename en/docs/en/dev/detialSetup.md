# Detailed EcuBus-Pro Development Environment Setup Guide

This guide provides detailed instructions for setting up the EcuBus development environment. Before we begin, please prepare the following:

1. Node.js - Download the latest version from the official website
2. EcuBus source code - Download the latest version from GitHub

With these prerequisites ready, we can proceed with the installation.

## Step 1: Install Node.js

Follow these steps to install Node.js:

![1](detail/1.jpg)

Click "Next":

![2](detail/2.jpg)

Click "Next":

![3](detail/3.jpg)

Click "Next":

![4](detail/4.jpg)

Click "Next":

![5](detail/5.jpg)

Make sure to check the box highlighted in the image above. This will automatically install Python and VS2019 required for Node.js. We recommend checking this box even if you already have these programs installed.

![6](detail/6.jpg)

Click "Install":

![7](detail/7.jpg)

Installation in progress...

![8](detail/8.jpg)

Click "Finish". The following screen will appear; press any key to continue:

![9](detail/9.jpg)

Press any key to continue:

![10](detail/10.jpg)

The next screen will check if your computer has Python and VS already installed. If not, it will install them. The first-time installation may take some time:

![11](detail/11.jpg)

Since my computer already had Python 3.13.3 and VS2019 installed, these were skipped:

![12](detail/12.jpg)

Python 3.13.3 and VS2019 development environments are now installed. You can exit this screen.

## Step 2: Install NPM Packages

We've completed the Node.js installation. Now let's install the NPM packages.

Navigate to the EcuBus project directory (E:\EcuBus\EcuBus_install\EcuBus-Pro-master in this example):

![13](detail/13.jpg)

Run the `npm install` command:

![14](detail/14.jpg)

## Step 3: Compile Native Modules

After the installation completes, navigate to the src/main/docan directory:

![15](detail/15.jpg)

Run the following command to compile: `npx node-gyp rebuild`

![16](detail/16.jpg)

As shown, there are 104 errors. This problem confused me for a long time. Initially, I thought it was an environment issue, but **it was actually due to the encoding format of the .h files**.

![17](detail/17.jpg)

Opening the toomoss folder with Notepad, we find that offline_type.h is encoded in UTF-8:

![18](detail/18.jpg)

Change the format to UTF-8 with BOM and recompile:

![19](detail/19.jpg)

Now the errors are reduced to 75, with issues in the tsfn.cxx file:

![20](detail/20.jpg)

Change the tsfn.cxx file encoding to BOM format:

![21](detail/21.jpg)

After this change, run the compilation command again:

![22](detail/22.jpg)

Compilation now succeeds:

![23](detail/23.jpg)

Problem solved!

## Step 4: Compile the Dolin Module

Next, navigate to the dolin folder and run the compilation command:

![24](detail/24.jpg)

We encounter errors again, likely due to file encoding issues:

![25](detail/25.jpg)

First, we modify the tsfn.cxx file encoding format:

![26](detail/26.jpg)

Compilation still fails with the same errors. To identify which file has format problems, open the project in VS2019 or VS2022:

![27](detail/27.jpg)

When compiling in VS2019, we get the following error:

![28](detail/28.jpg)

We discover that the usb2lin_ex.h file has encoding issues. After modifying it and recompiling:

![29](detail/29.jpg)

Error resolved!

## Step 5: Launch the Application

Return to the main directory and run `npm run dev`:

![30](detail/30.jpg)

After a few moments, the EcuBus software interface will appear, indicating that the environment setup is complete.

![31](detail/31.jpg)

## Summary

File encoding formats significantly impacted the compilation process. This was my first encounter with such an issue, possibly due to cross-platform compilation requirements for specific file encoding formats.

I hope this guide helps if you encounter similar problems. Thank you!
