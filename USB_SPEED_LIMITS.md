# Understanding USB Write Speed Limitations

## Your Current Situation
- **Current Speed:** ~11 MB/s
- **Drive:** 64GB USB (SanDisk Cruzer Blade)
- **Expected Time:** ~1.5-2 hours for full 64GB wipe

## Why Is It This Slow?

### Hardware Bottleneck
The **11 MB/s speed is likely your USB drive's maximum write speed**, not a software limitation. Here's why:

1. **USB Drive Quality**
   - Budget USB drives: 5-15 MB/s write
   - Mid-range USB drives: 20-40 MB/s write
   - High-end USB 3.0/3.1 drives: 50-200+ MB/s write

2. **USB Interface**
   - **USB 2.0:** Max theoretical 60 MB/s (35-40 MB/s real-world)
   - **USB 3.0:** Max theoretical 625 MB/s (100-400 MB/s real-world)
   - **USB 3.1/3.2:** Even faster

3. **The SanDisk Cruzer Blade**
   - This specific model is known for **slow write speeds** (10-15 MB/s)
   - It's a USB 2.0 drive with budget flash memory
   - **This is normal for this drive**

## What I've Already Optimized

✅ **Software is maximized:**
- Direct disk I/O (FILE_FLAG_NO_BUFFERING)
- 128MB buffer size
- Aligned memory allocation
- Minimal progress reporting overhead
- Volume dismounting before write

## Can We Go Faster?

### Short Answer: **Not Significantly**
The software is already optimized. The 11 MB/s speed is your **USB drive's physical write speed limit**.

### What You Can Do:
1. **Use a faster USB drive:**
   - USB 3.0/3.1 drive with good reviews
   - Look for drives spec'd at 50+ MB/s write
   - Brands: Samsung BAR Plus, SanDisk Ultra Fit (USB 3.1), Kingston DataTraveler

2. **Use USB 3.0/3.1 port on your computer:**
   - Blue/teal USB ports = USB 3.0+
   - Black USB ports = usually USB 2.0

3. **For fastest wiping:**
   - Use an internal SSD via SATA (500+ MB/s possible)
   - Or high-end USB 3.1/3.2 drive

## Time Estimates
- **Current (11 MB/s):** ~97 minutes for 64GB
- **USB 3.0 budget drive (40 MB/s):** ~27 minutes
- **USB 3.1 premium drive (100 MB/s):** ~11 minutes
- **Internal SSD (500 MB/s):** ~2 minutes

## Bottom Line
Your software is **already at maximum performance**. The speed is limited by the USB drive's flash memory and controller, not the code.
