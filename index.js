import express from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import pLimit from 'p-limit';
import os from 'os';

const app = express();
const PORT = 3001;

// Constants for max file size and concurrency
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
const CONCURRENCY_LIMIT = 5; // Limit concurrent file processing
const BATCH_SIZE = 5; // Number of files per batch

// Helper function to create the necessary output directories
const ensureOutputDirExists = async (outputDir) => {
    await fs.mkdir(outputDir, { recursive: true });
};

// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to process a single file
const processFile = async (file, uploadsDir, convertFormat, outputDir) => {
    try {
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.stat(filePath);
        const fileSizeInBytes = stats.size;

        // Skip files larger than 20MB
        if (fileSizeInBytes > MAX_FILE_SIZE) {
            console.log(`Skipping ${file} (size: ${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB) - exceeds 20MB`);
            return;
        }

        const outputFileName = `${path.parse(file).name}.${convertFormat}`;
        const outputFilePath = path.join(outputDir, outputFileName);

        // Convert the image
        await sharp(filePath)
            .toFormat(convertFormat)
            .toFile(outputFilePath);

        console.log(`Converted ${file} and saved to ${outputFilePath}`);
    } catch (error) {
        console.error(`Error processing file ${file}:`, error);
    }
};

// Function to process files in batches
const processBatches = async (files, uploadsDir, convertFormat, outputDir) => {
    // Split files into batches of BATCH_SIZE
    const batches = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batches.push(files.slice(i, i + BATCH_SIZE));
    }

    // Process each batch simultaneously
    await Promise.all(
        batches.map(async (batch, index) => {
            console.log(`Processing batch ${index + 1}/${batches.length} with ${batch.length} files.`);
            const limit = pLimit(CONCURRENCY_LIMIT);
            const tasks = batch.map((file) => limit(() => processFile(file, uploadsDir, convertFormat, outputDir)));
            await Promise.all(tasks);
            console.log(`Finished processing batch ${index + 1}/${batches.length}.`);
        })
    );
};

// POST route to process all images from the specified folder and convert to the specified format
app.post('/convert-all', async (req, res) => {
    try {
        const { directory, convertFormat, outputDirectory, folderName } = req.body; // Get the directory path, convertFormat, and outputDirectory from the body

        // Validate convertFormat - ensure it is a valid format
        const validFormats = ['jpeg', 'png', 'webp', 'gif', 'avif'];
        if (!validFormats.includes(convertFormat)) {
            return res.status(400).send(`Invalid image format. Supported formats are: ${validFormats.join(', ')}`);
        }

        // If directory is not provided, use the default uploads folder
        const uploadsDir = directory ? path.resolve(directory) : path.join(os.homedir(), 'Pictures'); // Default to "Pictures" folder if not provided

        // Determine output directory - if not provided, use default '~/Downloads/upload-images'
        let finalOutputDir = outputDirectory ? path.resolve(outputDirectory) : path.join(os.homedir(), 'Downloads', 'upload-images');

        // If folderName is provided, create that folder inside the outputDirectory or default directory
        if (folderName) {
            finalOutputDir = path.join(finalOutputDir, folderName);
        }

        // Ensure both directories exist
        await fs.stat(uploadsDir);
        await ensureOutputDirExists(finalOutputDir);

        // Get the files in the specified directory
        const files = await fs.readdir(uploadsDir);

        if (files.length === 0) {
            return res.status(404).send('No files found in the specified folder.');
        }

        // Process files in batches
        await processBatches(files, uploadsDir, convertFormat, finalOutputDir);

        res.status(200).send('All images processed and saved to the specified output folder.');
    } catch (error) {
        console.error('Error processing images:', error);
        res.status(500).send('An error occurred while processing images.');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
