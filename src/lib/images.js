// Photo processing. Every uploaded image becomes three JPEGs:
//   <base>-large.jpg   max 1800px long edge  (lightbox, hero)
//   <base>-medium.jpg  max 1100px            (job page gallery)
//   <base>-thumb.jpg   640x480 center crop   (cards and grids)
// EXIF is stripped (no GPS leaves the phone) and orientation is applied.
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const sharp = require('sharp');
const { DATA_DIR } = require('../config');

const UPLOADS = path.join(DATA_DIR, 'uploads');

function jobDir(slugOrId) {
  return path.join(UPLOADS, String(slugOrId));
}

function newBase() {
  return Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
}

async function processUpload(srcPath, jobFolder) {
  const dir = jobDir(jobFolder);
  await fs.mkdir(dir, { recursive: true });
  const base = newBase();
  const img = sharp(srcPath, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error('That file is not an image we can read.');

  const large = await img.clone().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(path.join(dir, `${base}-large.jpg`));
  await img.clone().resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(path.join(dir, `${base}-medium.jpg`));
  await img.clone().resize({ width: 640, height: 480, fit: 'cover', position: 'attention' })
    .jpeg({ quality: 78, progressive: true, mozjpeg: true }).toFile(path.join(dir, `${base}-thumb.jpg`));

  return { base, w: large.width, h: large.height };
}

async function deletePhotoFiles(jobFolder, base) {
  const dir = jobDir(jobFolder);
  for (const s of ['large', 'medium', 'thumb']) {
    await fs.rm(path.join(dir, `${base}-${s}.jpg`), { force: true });
  }
}

async function deleteJobFolder(jobFolder) {
  await fs.rm(jobDir(jobFolder), { recursive: true, force: true });
}

async function renameJobFolder(oldFolder, newFolder) {
  if (oldFolder === newFolder) return;
  try {
    await fs.rename(jobDir(oldFolder), jobDir(newFolder));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

function url(jobFolder, base, size) {
  return `/uploads/${encodeURIComponent(jobFolder)}/${base}-${size}.jpg`;
}

module.exports = { UPLOADS, jobDir, processUpload, deletePhotoFiles, deleteJobFolder, renameJobFolder, url };
