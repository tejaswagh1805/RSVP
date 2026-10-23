import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const oldBase = String(process.env.OLD_MEDIA_BASE_URL || "").replace(/\/$/, "");
const newBase = String(process.env.NEW_MEDIA_BASE_URL || "").replace(/\/$/, "");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!oldBase || !newBase || !/^https:\/\//.test(oldBase) || !/^https:\/\//.test(newBase)) {
  throw new Error("Set OLD_MEDIA_BASE_URL and NEW_MEDIA_BASE_URL to HTTPS base URLs.");
}

const sql = neon(process.env.DATABASE_URL);
const results = await Promise.all([
  sql`UPDATE site_media SET image_url = replace(image_url, ${oldBase}, ${newBase}) WHERE image_url LIKE ${oldBase} || '/%' RETURNING id`,
  sql`UPDATE people_profiles SET image_url = replace(image_url, ${oldBase}, ${newBase}) WHERE image_url LIKE ${oldBase} || '/%' RETURNING id`,
  sql`UPDATE events SET image_data = replace(image_data, ${oldBase}, ${newBase}) WHERE image_data LIKE ${oldBase} || '/%' RETURNING id`,
  sql`UPDATE events SET image_gallery = ARRAY(SELECT replace(media_url, ${oldBase}, ${newBase}) FROM unnest(image_gallery) AS media_url) WHERE EXISTS (SELECT 1 FROM unnest(image_gallery) AS media_url WHERE media_url LIKE ${oldBase} || '/%') RETURNING id`,
  sql`UPDATE events SET video_url = replace(video_url, ${oldBase}, ${newBase}) WHERE video_url LIKE ${oldBase} || '/%' RETURNING id`,
]);
const labels = ["site media images", "people profile images", "event cover images", "event gallery images", "event videos"];
for (let index = 0; index < results.length; index += 1) {
  console.log(`${labels[index]} updated: ${results[index].length}`);
}
