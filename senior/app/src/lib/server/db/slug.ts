export function slugifyGrocerFolder(folderName: string): string {
  return folderName
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function titleCaseFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolveGrocerFromPath(filePath: string): { slug: string; folder: string } | null {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const grocersIndex = parts.findIndex((part) => part === 'grocers-files');
  const folder = grocersIndex >= 0 ? parts[grocersIndex + 1] : parts.length >= 2 ? parts[parts.length - 2] : null;

  if (!folder) {
    return null;
  }

  return {
    folder,
    slug: slugifyGrocerFolder(folder)
  };
}
