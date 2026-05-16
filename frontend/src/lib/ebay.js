// Deep-link URL builders for eBay Sold listings, eBay Terapeak research,
// and Discogs marketplace. No API calls — pure URL templates the user clicks.

/**
 * Build the eBay Sold (completed) listings URL, sorted price+shipping high-to-low.
 * _sop=16 → price + shipping, highest first
 * LH_Sold=1 LH_Complete=1 → sold listings only
 */
export function ebaySoldUrl(artist, title) {
  const q = encodeURIComponent(`${artist} ${title} vinyl`.trim());
  return `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&_sop=16`;
}

/**
 * Build the eBay Terapeak (Seller Hub Research) URL with a 90-day window of SOLD items.
 * Requires the user to be signed into eBay Seller Hub for the page to render data.
 */
export function ebayTerapeakUrl(artist, title) {
  const q = encodeURIComponent(`${artist} ${title} vinyl`.trim());
  return `https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=${q}&dayRange=90&tabName=SOLD`;
}

/**
 * Build the Discogs marketplace search URL for this artist+title.
 * format=Vinyl scopes to LP/12"/7"/etc.
 */
export function discogsSearchUrl(artist, title) {
  const q = encodeURIComponent(`${artist} ${title}`.trim());
  return `https://www.discogs.com/search/?q=${q}&type=release&format_exact=Vinyl`;
}

/**
 * Direct link to a specific Discogs release page.
 */
export function discogsReleaseUrl(releaseId) {
  return `https://www.discogs.com/release/${releaseId}`;
}
