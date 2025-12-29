# DropDrive - Professional Secure Disk Wiping Solution

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-Private-red.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey.svg)

**DropDrive** is a professional-grade desktop application for secure data destruction and disk wiping. It provides military-grade data sanitization with compliance certification generation, built on a modern tech stack combining Next.js frontend with Electron for cross-platform desktop deployment and native C++ modules for high-performance disk operations.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [Wipe Methods & Standards](#wipe-methods--standards)
- [Certificate System](#certificate-system)
- [Development](#development)
- [Build & Distribution](#build--distribution)

---

## 🎯 Overview

DropDrive is designed for organizations and individuals who need to securely erase data from storage devices in compliance with industry standards such as **NIST SP 800-88**, **DoD 5220.22-M**, and **Gutmann method**. The application provides:

- **High-performance disk wiping** using native C++ modules with optimized buffer management (32MB buffers)
- **Compliance certification** with automatic JSON and PDF certificate generation
- **Modern UI** built with Next.js 14 and shadcn/ui components
- **Real-time progress tracking** with detailed operation logs
- **Device management** with automatic drive detection and system information
- **Cross-platform support** for Windows and Linux

### Current Objective

The project is in active development with the following objectives:

1. **Production-ready wiping engine** - Implement robust error handling and verification
2. **Certificate compliance** - Ensure generated certificates meet NIST standards
3. **Performance optimization** - Achieve 50-150 MB/s wipe speeds on USB 3.0 devices
4. **User experience refinement** - Polish UI/UX for professional deployment
5. **Testing & validation** - Comprehensive testing of all wipe methods and edge cases

---

## ✨ Key Features

### 🔒 Secure Data Sanitization

- **Multiple wipe standards**: Zero Fill, Random Fill, NIST 800-88, DoD 5220.22-M, Gutmann (35-pass)
- **Native C++ implementation**: Direct disk I/O with optimized buffering for maximum performance
- **USB device management**: Automatic unmount/remount with diskpart integration
- **Real-time progress monitoring**: Live updates with speed metrics and completion estimates

### 📜 Compliance & Certification

- **Automatic certificate generation**: Creates JSON and PDF certificates for each wipe operation
- **NIST profile mapping**: Categorizes wipes as Clear, Purge, or Destroy
- **Audit trails**: Comprehensive logs with timestamps, device info, and operation details
- **QR code integration**: Machine-readable verification codes in PDF certificates

### 💻 Professional Interface

- **Modern dashboard**: System overview with drive statistics and recent activity
- **Wipe process wizard**: Step-by-step guidance through device selection and method choice
- **Certificate management**: Browse, search, and download historical certificates
- **Settings & help**: Configurable preferences and comprehensive documentation

### 🔧 Device Management

- **Automatic drive detection**: Uses `drivelist` and `systeminformation` for device discovery
- **Volume information**: Real-time disk usage, filesystem type, and capacity
- **Physical drive access**: Windows PhysicalDrive and Linux block device support
- **Smart device verification**: Pre-wipe checks to ensure device accessibility

---

## 🏗️ Architecture

DropDrive follows a **hybrid architecture** combining web technologies for the UI with native code for performance-critical operations:

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  IPC Handlers (main.js)                                │ │
│  │  - System info, drive listing, wipe control            │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌─────────────────┐      │      ┌──────────────────────┐  │
│  │ Wipe Controller │◄─────┴─────►│ Certificate Generator│  │
│  │  - USB Manager  │              │  - JSON generation   │  │
│  │  - Progress     │              │  - PDF generation    │  │
│  └────────┬────────┘              └──────────────────────┘  │
│           │                                                  │
│  ┌────────▼─────────────────────────────────────────────┐  │
│  │  Native C++ Addon (wipeAddon.node)                   │  │
│  │  - Direct disk I/O with 32MB buffers                 │  │
│  │  - Multi-pass wipe implementations                   │  │
│  │  - Device size detection & locking                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ IPC
                            │
┌─────────────────────────────────────────────────────────────┐
│                  Electron Renderer Process                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Next.js 14 Application                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │ │
│  │  │Dashboard │  │   Wipe   │  │    Certificates     │ │ │
│  │  │Component │  │ Process  │  │     Component       │ │ │
│  │  └──────────┘  └──────────┘  └─────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │ │
│  │  │Settings  │  │   Help   │  │   UI Components     │ │ │
│  │  │Component │  │Component │  │   (shadcn/ui)       │ │ │
│  │  └──────────┘  └──────────┘  └─────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User initiates wipe** → React component calls IPC handler via preload bridge
2. **Main process** → Validates device, unmounts volume, calls native addon
3. **Native C++ addon** → Performs low-level disk writes with progress callbacks
4. **Progress updates** → Stream back to renderer via IPC events
5. **Certificate generation** → Creates JSON/PDF on completion, stores in `/certificates`

---

## 🛠️ Technology Stack

### Frontend

- **Next.js 14** - React framework with App Router
- **React 18** - UI library with hooks and modern features
- **TypeScript 5** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - High-quality React component library based on Radix UI
- **Lucide React** - Icon library
- **Recharts** - Data visualization (for progress charts)

### Desktop Framework

- **Electron 38** - Cross-platform desktop wrapper
- **electron-builder** - Packaging and distribution

### Backend / Node.js

- **systeminformation** - Cross-platform system and device info
- **drivelist** - Enumerate storage devices
- **diskusage** - Disk space information
- **node-addon-api** - N-API bindings for C++ addon

### Native Layer

- **C++17** - Native disk wiping implementation
- **Node-API (N-API)** - Stable Node.js C++ addon interface
- **Windows API** - Direct disk access on Windows (CreateFile, DeviceIoControl)
- **Linux syscalls** - Block device operations on Linux

### Document Generation

- **PDFKit** - PDF certificate generation
- **QRCode** - QR code generation for certificates
- **UUID** - Unique certificate identifiers

---

## 📁 Project Structure

```
DropDrive/
├── app/                          # Next.js App Router
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout with theme provider
│   └── page.tsx                  # Main application page
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components (50+ components)
│   ├── app-sidebar.tsx           # Application sidebar navigation
│   ├── dashboard.tsx             # Dashboard with system info & volumes
│   ├── wipe-process.tsx          # Wipe operation workflow
│   ├── certificates.tsx          # Certificate management
│   ├── settings.tsx              # Application settings
│   ├── help.tsx                  # Help & documentation
│   └── theme-provider.tsx        # Dark/light theme management
│
├── electron/                     # Electron main process
│   ├── main.js                   # Main entry point, IPC handlers
│   ├── preload.js                # Secure IPC bridge
│   ├── wipeController.js         # Wipe operation orchestration
│   ├── deviceManager.js          # Drive listing and detection
│   ├── certificateGenerator.js   # JSON certificate generation
│   ├── pdfCertificateGenerator.js # PDF certificate with QR codes
│   ├── verifyCertificate.js      # Certificate validation
│   └── test-*.js                 # Test scripts for various modules
│
├── native/                       # Native C++ addon
│   ├── wipeAddon.cpp             # Main addon implementation
│   ├── binding.gyp               # Node-gyp build configuration
│   ├── wipeMethods/              # Wipe algorithm implementations
│   │   ├── zeroFill.cpp          # Zero-fill wipe
│   │   ├── randomFill.cpp        # Random data wipe
│   │   ├── nistWipe.cpp          # NIST 800-88 Clear
│   │   ├── dodWipe.cpp           # DoD 5220.22-M
│   │   ├── wipeCommon.h          # Shared utilities
│   │   └── purge/                # Advanced purge methods
│   └── build/                    # Compiled addon output
│
├── certificates/                 # Generated wipe certificates
│   ├── certificate_*.json        # Certificate data
│   └── certificate_*.pdf         # PDF exports
│
├── hooks/                        # React custom hooks
├── lib/                          # Utility libraries
├── public/                       # Static assets
├── styles/                       # Additional stylesheets
│
├── package.json                  # Dependencies and scripts
├── next.config.mjs               # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.js            # Tailwind CSS configuration
└── components.json               # shadcn/ui configuration
```

---

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **pnpm**
- **Python** 3.x (for node-gyp)
- **Visual Studio Build Tools** (Windows) or **build-essential** (Linux)
- **Administrator/root privileges** (required for disk operations)

### Installation Steps

1. **Clone the repository**
   ```bash
   cd DropDrive_forked
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Build the native C++ addon**
   ```bash
   cd native
   npx node-gyp configure
   npx node-gyp build
   cd ..
   ```

   The compiled addon will be at: `native/build/Release/wipeAddon.node`

4. **Verify the build**
   ```bash
   node electron/test-addon.js
   ```

   Expected output: "Wipe completed successfully" or similar confirmation

---

## 💡 Usage Guide

### Running in Development Mode

#### Option 1: Run Next.js and Electron separately

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start Electron (after Next.js is running)
npm run electron
```

#### Option 2: Run both concurrently

```bash
npm run dev:all
```

This starts the Next.js dev server on `http://localhost:3000` and waits for it to be ready before launching Electron.

### Application Workflow

1. **Dashboard** - View system information, connected drives, and recent activity
2. **Start Wipe** - Click "Start Secure Wipe" button
3. **Select Device** - Choose the drive to wipe from detected devices
4. **Choose Method** - Select wipe standard (Zero, NIST, DoD, Gutmann, etc.)
5. **Confirm & Execute** - Review settings and start the wipe operation
6. **Monitor Progress** - Watch real-time progress with speed metrics
7. **Certificate Generation** - Automatic generation upon completion
8. **View Certificate** - Access from the Certificates tab, download PDF

### Testing the Native Addon

```bash
# Test basic addon functionality
node electron/test-addon.js

# Test device manager
node electron/testDeviceManager.js

# Test wipe controller
node electron/testWipeController.js

# Test certificate generation
node electron/testCertificate.js
```

---

## 🔐 Wipe Methods & Standards

### Supported Wipe Standards

| Method | Passes | Description | Compliance |
|--------|--------|-------------|------------|
| **Zero Fill** | 1 | Overwrites with zeros (0x00) | NIST Clear |
| **Random Fill** | 1 | Overwrites with random data | NIST Clear |
| **NIST 800-88 Clear** | 1 | Single pass with zeros or random | NIST SP 800-88 Rev. 1 |
| **DoD 5220.22-M** | 3 | Zero, complement, random pattern | DoD Standard (superseded) |
| **Gutmann** | 35 | 35-pass overwrite with complex patterns | Research method |

### Pass Counts by Method

- **Zero Fill**: 1 pass
- **Random Fill**: 1 pass  
- **NIST 800-88**: 1 pass (recommended for modern drives)
- **DoD 5220.22-M**: 3 passes (legacy compliance)
- **Gutmann**: 35 passes (maximum security, historical)

### NIST Profile Mapping

According to NIST SP 800-88:

- **Clear** - 1-pass methods (Zero, Random, NIST)
- **Purge** - Multi-pass methods (DoD)
- **Destroy** - Physical destruction (Gutmann considered equivalent)

### Performance Expectations

With the optimized C++ implementation (32MB buffers):

- **USB 2.0**: 15-30 MB/s
- **USB 3.0**: 50-150 MB/s
- **Internal SATA SSD**: 200-500 MB/s
- **NVMe SSD**: May be limited by sequential write speed

**Example**: A 128GB USB 3.0 drive with DoD 5220.22-M (3 passes):
- Speed: ~80 MB/s
- Time per pass: ~27 minutes
- Total time: ~81 minutes (1.35 hours)

---

## 📜 Certificate System

### Certificate Structure

Each wipe operation generates a certificate with the following information:

```json
{
  "certificate_id": "uuid-v4-string",
  "timestamp_utc": "2024-01-15T14:30:00.000Z",
  "operator": "username",
  "device_info": {
    "serial_number": "SerialXYZ",
    "model": "Samsung SSD 860 EVO",
    "type": "SSD",
    "capacity": "512GB"
  },
  "erase_method": "DoD 5220.22-M",
  "nist_profile": "Purge",
  "post_wipe_status": "success",
  "logs": [
    "Wipe started at 14:30:00",
    "Unmounting drive...",
    "Pass 1/3 - DoD",
    "...operation logs..."
  ],
  "tool_version": "2.1.0"
}
```

### Certificate Storage

- **Location**: `certificates/` folder in project root
- **Formats**: JSON (`.json`) and PDF (`.pdf`)
- **Naming**: `certificate_<uuid>.json` and `certificate_<uuid>.pdf`
- **Persistence**: Certificates remain after wipe completion for audit purposes

### PDF Certificates

PDF certificates include:

- Header with company/tool branding
- QR code for machine-readable verification
- Complete device and operation details
- Timestamped audit trail
- NIST compliance designation
- Digital signature placeholder (for future implementation)

### Certificate Management

- **View all certificates**: Certificates tab shows sortable, searchable list
- **Download PDF**: Single-click download from the UI
- **Verify certificate**: Use `electron/verifyCertificate.js` to validate JSON integrity
- **Export/archive**: Copy entire `certificates/` folder for backup

---

## 👨‍💻 Development

### Development Scripts

```bash
# Start Next.js dev server only
npm run dev

# Start Electron only (requires Next.js running)
npm run electron

# Run both Next.js and Electron concurrently
npm run dev:all

# Build Next.js for production
npm run build

# Build and export Next.js to static files
npm run build:next
```

### Building the Native Addon

The C++ addon must be recompiled after changes:

```bash
cd native
npx node-gyp rebuild
cd ..
```

For development with automatic rebuilds, consider using `node-gyp-build` or similar tools.

### Code Organization

- **React components**: Keep in `/components`, use TypeScript
- **Electron IPC handlers**: Add to `electron/main.js`
- **Wipe logic**: Extend `electron/wipeController.js` or native methods
- **C++ wipe methods**: Add new algorithms in `native/wipeMethods/`

### Adding a New Wipe Method

1. **Implement C++ function** in `native/wipeMethods/yourmethod.cpp`
2. **Register in addon** - Add to `wipeAddon.cpp` exports
3. **Update controller** - Add method to `wipeController.js` switch cases
4. **Update UI** - Add option to `components/wipe-process.tsx` method selector
5. **Test thoroughly** - Create test file in `electron/test-yourmethod.js`

---

## 📦 Build & Distribution

### Building for Production

```bash
# Build Next.js application
npm run build

# Package Electron app for current platform
npm run dist
```

This uses `electron-builder` to create distributable packages (`.exe` for Windows, `.AppImage`/`.deb` for Linux).

### Build Configuration

Edit `package.json` to configure `electron-builder`:

- **Target platforms**: Windows, Linux, macOS
- **Installer types**: NSIS (Windows), AppImage/DEB (Linux), DMG (macOS)
- **Code signing**: Add certificate configuration for production
- **Auto-update**: Configure update server for automatic updates

### Distribution Checklist

- [ ] Test all wipe methods on target platform
- [ ] Verify certificate generation
- [ ] Test with various USB drive types and sizes
- [ ] Sign binaries for production (Windows, macOS)
- [ ] Create installer/package with correct permissions
- [ ] Document system requirements clearly
- [ ] Provide user manual and compliance documentation

---

## 🔧 Troubleshooting

### Native Addon Build Fails

**Issue**: `node-gyp` errors during `npm install`

**Solutions**:
- Install Python 3.x and Visual Studio Build Tools (Windows)
- Run `npm install --global node-gyp`
- On Windows, run: `npm install --global --production windows-build-tools`
- Check Node.js version (18+ required)

### Cannot Access Drive / Permission Denied

**Issue**: "ERROR: Cannot open device" when attempting wipe

**Solutions**:
- **Windows**: Run application as Administrator
- **Linux**: Run with `sudo` or add user to `disk` group
- Ensure drive is not mounted by another process
- Check if drive is write-protected (hardware switch)

### Electron Window Blank / Not Loading

**Issue**: Electron opens but shows blank window

**Solutions**:
- Ensure Next.js dev server is running (`npm run dev`)
- Check `electron/main.js` for correct URL (`http://localhost:3000`)
- Open DevTools (F12) to check for console errors
- Verify preload script path is correct

### Wipe Speed Very Slow

**Issue**: Wipe operation progressing at <10 MB/s

**Solutions**:
- Check USB connection (use USB 3.0 port for 3.0 drives)
- Verify no other processes are accessing the drive
- Try different wipe method (Zero Fill is fastest)
- Check drive health (may be failing hardware)
- On Windows, disable Windows Defender scanning temporarily

---

## 📝 Current Project Status

### Completed ✅

- ✅ Next.js + Electron integration
- ✅ React UI with shadcn/ui components
- ✅ Native C++ wipe addon with optimized performance
- ✅ Device detection and system information
- ✅ Multiple wipe standard implementations
- ✅ JSON and PDF certificate generation
- ✅ Real-time progress tracking
- ✅ USB drive unmount/remount automation

### In Progress 🚧

- 🚧 Comprehensive error handling and recovery
- 🚧 Wipe verification and post-wipe validation
- 🚧 Enhanced certificate validation and signing
- 🚧 Multi-language support (i18n)
- 🚧 Advanced settings and customization

### Planned 📅

- 📅 Network drive support
- 📅 Scheduled wipe operations
- 📅 Cloud certificate backup
- 📅 Mobile companion app for monitoring
- 📅 Enterprise license management
- 📅 Custom wipe pattern designer

---

## 🤝 Contributing

This is currently a private project. For questions or collaboration inquiries, please contact the project maintainers.

---

## 📄 License

Private - All rights reserved.

---

## 📞 Support

For technical support or bug reports, please refer to the project's issue tracker or contact the development team.

---

**DropDrive** - Professional Secure Data Destruction
*Version 0.1.0 - Built with ❤️ using Next.js & Electron*
