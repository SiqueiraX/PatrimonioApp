export const neighborhoodKey = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export function neighborhoodPhotos(land, neighborhoods = []) {
 if (land.photos?.length) return land.photos;
 return neighborhoods.find(n => neighborhoodKey(n.name) === neighborhoodKey(land.neighborhood))?.photos || [];
}
