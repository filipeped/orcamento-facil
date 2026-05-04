import { getSupabase } from "./supabase";

/**
 * Upload an image to Supabase Storage
 * @param file - The file to upload
 * @param folder - The folder to upload to (e.g., 'catalog', 'logos')
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(
  file: File,
  folder: string = "general"
): Promise<string | null> {
  try {
    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    // Upload file using authenticated client
    const { error: uploadError } = await getSupabase().storage
      .from("images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data } = getSupabase().storage.from("images").getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
}

/**
 * Delete an image from Supabase Storage
 * @param url - The public URL of the image to delete
 */
export async function deleteImage(url: string): Promise<boolean> {
  try {
    // Extract file path from URL
    const urlParts = url.split("/images/");
    if (urlParts.length < 2) return false;

    const filePath = urlParts[1];

    const { error } = await getSupabase().storage.from("images").remove([filePath]);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
}
