import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('./public/flexa-icon.svg')
const BG = '#F7F3EE'

const targets = [
  { size: 512, file: 'public/icon-512.png' },
  { size: 192, file: 'public/icon-192.png' },
  { size: 180, file: 'public/apple-touch-icon.png' },
]

for (const { size, file } of targets) {
  const padding = Math.round(size * 0.18)
  const inner = size - padding * 2
  await sharp(svg)
    .resize(inner, inner)
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(file)
  console.log(`✓ ${file} (${size}×${size})`)
}
