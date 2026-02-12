const cache = new Map()

export async function fetchVideoInfo(bvid) {
  if (cache.has(bvid)) {
    return cache.get(bvid)
  }

  try {
    const response = await fetch(`/api/bilibili/x/web-interface/view?bvid=${bvid}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch video info: ${response.status}`)
    }
    const json = await response.json()
    if (json.code !== 0) {
      throw new Error(json.message || 'Bilibili API error')
    }
    const info = {
      bvid: json.data.bvid,
      title: json.data.title,
      coverUrl: json.data.pic,
      description: json.data.desc,
      duration: json.data.duration,
      pubdate: json.data.pubdate,
      owner: json.data.owner,
    }
    cache.set(bvid, info)
    return info
  } catch (error) {
    console.warn(`Failed to fetch Bilibili video info for ${bvid}:`, error)
    return null
  }
}

export function getCachedVideoInfo(bvid) {
  return cache.get(bvid) || null
}
