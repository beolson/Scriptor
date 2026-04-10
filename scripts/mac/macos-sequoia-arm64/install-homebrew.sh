#!/bin/bash
# ---
# platform: macos-sequoia-arm64
# title: Install Homebrew
# ---
# Installs [Homebrew](https://brew.sh), the missing package manager for macOS.
#
# ## What it does
#
# Runs the official Homebrew install script, which sets up the `brew` command and its dependencies (including the Xcode Command Line Tools if not already present).
#
# ## Requirements
#
# - macOS Sequoia (15)
# - Internet connection

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
