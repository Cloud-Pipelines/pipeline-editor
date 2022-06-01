/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

const httpGetWithCache = async (
  urlOrRequest: string | RequestInfo,
  cacheName: string,
  updateIfInCache: boolean = false
): Promise<string> => {
  const cache = await caches.open(cacheName);
  const response = await cache.match(urlOrRequest);
  if (response !== undefined) {
    if (updateIfInCache) {
      cache.add(urlOrRequest);
    }
    return response.text();
  }
  await cache.add(urlOrRequest);
  const response2 = await cache.match(urlOrRequest);
  if (response2 === undefined) {
    return Promise.reject("Added object to cache, but could not find it");
  }
  return response2.text();
};

export type DownloadTextType = (url: string) => Promise<string>;

export async function downloadText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Network response was not OK: ${response.status}: ${response.statusText}`
    );
  }
  const data = await response.blob();
  const text = data.text();
  return text;
}

const IMMUTABLE_URL_REGEXPS = [
  /^https:\/\/raw.githubusercontent.com\/[-A-Za-z_]+\/[-A-Za-z_]+\/[0-9a-fA-f]{40}\/.*/,
  /^https:\/\/gitlab.com\/([-A-Za-z_]+\/){2,}-\/raw\/[0-9a-fA-f]{40}\/.*/,
];

export async function downloadTextWithCache(url: string): Promise<string> {
  const isImmutable = IMMUTABLE_URL_REGEXPS.some((regexp) => url.match(regexp));
  return httpGetWithCache(url, "cache", !isImmutable);
}
