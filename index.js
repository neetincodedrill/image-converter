const express = require("express");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3001;

// Folders
const uploadsDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "update-image");

const convertFormat = "png"; //JPEG, PNG, WebP, GIF, AVIF and TIFF formats
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const COMPRESS_THRESHOLD = 1 * 1024 * 1024; // 1MB in bytes

// Ensure the folders exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// GET route to process all images in the uploads folder
app.get("/convert-all", async (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);

    if (files.length === 0) {
      return res.status(404).send("No files found in the uploads folder.");
    }

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);

      // Get the file size
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;

      // Skip files larger than 5MB
      if (fileSizeInBytes > MAX_FILE_SIZE) {
        console.log(
          `Skipping ${file} (size: ${(fileSizeInBytes / (1024 * 1024)).toFixed(
            2
          )} MB) - exceeds 5MB`
        );
        continue; // Move to the next file
      }

      const outputFileName = `${path.parse(file).name}.${convertFormat}`;
      const outputFilePath = path.join(outputDir, outputFileName);

      // Step 1: Convert the image without compression
      await sharp(filePath).toFormat(convertFormat).toFile(outputFilePath);

      // Step 2: Check the size of the converted image
      const convertedStats = fs.statSync(outputFilePath);
      const convertedSize = convertedStats.size;

      if (convertedSize > COMPRESS_THRESHOLD) {
        console.log(
          `Compressing ${file} (converted size: ${(
            convertedSize /
            (1024 * 1024)
          ).toFixed(2)} MB)`
        );

        // Step 3: Compress the converted image
        await sharp(outputFilePath)
          .toFormat(convertFormat, { quality: 50, mozjpeg: true })
          .toFile(outputFilePath);

        console.log(
          `Compressed and saved ${file} (final size: ${(
            fs.statSync(outputFilePath).size /
            (1024 * 1024)
          ).toFixed(2)} MB)`
        );
      } else {
        console.log(
          `Converted ${file} (size: ${(convertedSize / (1024 * 1024)).toFixed(
            2
          )} MB) - no compression needed`
        );
      }
    }

    res
      .status(200)
      .send("All images processed and saved to the update-image folder.");
  } catch (error) {
    console.error("Error processing images:", error);
    res.status(500).send("An error occurred while processing images.");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
