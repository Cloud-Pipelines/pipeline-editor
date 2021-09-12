/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import yaml from "js-yaml";
import localForage from "localforage";
import { ComponentSpec, ComponentReference } from "./componentSpec";

// const COMPONENT_FILE_NAME_SUFFIX = "component.yaml";
// const COMPONENT_FILE_MAX_SIZE = 100000;
const SEARCH_CACHE_NAME = "https://api.github.com/search";
const BLOB_CACHE_NAME = "raw.githubusercontent.com/.../component.yaml";

// IndexedDB: DB and table names
const DB_NAME = "components";
const HASH_TO_CONTENT_DB_TABLE_NAME = "hash_to_data";
const HASH_TO_COMPONENT_NAME_DB_TABLE_NAME = "hash_to_component_name";
const URL_TO_HASH_DB_TABLE_NAME = "url_to_hash";
const HASH_TO_URL_DB_TABLE_NAME = "hash_to_url";
const URL_PROCESSING_VERSION_TABLE_NAME = "url_version";
const CURRENT_URL_PROCESSING_VERSION = 1;
const BAD_HASHES_TABLE_NAME = "bad_hashes";

export const httpGetWithCache = async (
  urlOrRequest: string | RequestInfo,
  cacheName: string,
  updateIfInCache: boolean = false
): Promise<Response> => {
  const cache = await caches.open(cacheName);
  const response = await cache.match(urlOrRequest);
  if (response !== undefined) {
    if (updateIfInCache) {
      cache.add(urlOrRequest);
    }
    return response;
  }
  await cache.add(urlOrRequest);
  const response2 = await cache.match(urlOrRequest);
  if (response2 === undefined) {
    return Promise.reject("Added object to cache, but could not find it");
  }
  return response2;
};

export const searchGitHubCodeWithCache = async (
  query: string,
  page = 1,
  sort = "indexed",
  order = "desc"
): Promise<any> => {
  // TODO: Paging
  const encodedQuery = encodeURIComponent(query);
  const encodedSort = encodeURIComponent(sort);
  const encodedOrder = encodeURIComponent(order);
  const searchUrl = `https://api.github.com/search/code?q=${encodedQuery}&sort=${encodedSort}&order=${encodedOrder}&per_page=100&page=${page}`;
  const response = await httpGetWithCache(searchUrl, SEARCH_CACHE_NAME, true);
  return response.json();
};

const githubHtmlUrlToDownloadUrl = (htmlUrl: string): string => {
  // https://github.com/               kubeflow/pipelines/blob/24bc9162a56c2fe3c50947d655ef280f71ba058f/components/gcp/dataflow/launch_flex_template/component.yaml
  // https://raw.githubusercontent.com/kubeflow/pipelines     /24bc9162a56c2fe3c50947d655ef280f71ba058f/components/gcp/dataflow/launch_flex_template/component.yaml
  return htmlUrl
    .replace("https://github.com/", "https://raw.githubusercontent.com/")
    .replace("/blob/", "/");
};

type UrlAndHash = {
  url: string;
  hash: string;
};

export async function* getComponentUrlsAndHashes(
  users = ["kubeflow", "Ark-kun"]
) {
  let urlsAndHashes: UrlAndHash[] = [];
  const query =
    "filename:component.yaml " + users.map((user) => "user:" + user).join(" ");
  for (let page = 1; page < 100; page++) {
    const searchResults = await searchGitHubCodeWithCache(query, page);
    // "total_count": 512,
    // "incomplete_results": false,
    // "items": [
    const items: any[] = searchResults.items;
    if (items.length === 0) {
      break;
    }
    for (let item of items) {
      yield {
        url: githubHtmlUrlToDownloadUrl(item.html_url),
        hash: item.sha as string,
      };
    }
    await new Promise((resolve) =>
      setTimeout(resolve, ((60 * 1000) / 10) * (1 + 0.1))
    );
  }
  return urlsAndHashes;
}

export const cacheComponentCandidateBlobs = async (
  users = ["kubeflow", "Ark-kun"]
): Promise<any[]> => {
  let urlsAndHashes: UrlAndHash[] = [];
  let urls = [];
  for await (const urlAndHash of getComponentUrlsAndHashes(users)) {
    urlsAndHashes.push(urlAndHash);
    urls.push(urlAndHash.url);
  }
  const cache = await caches.open(BLOB_CACHE_NAME);
  await cache.addAll(urls);
  return urlsAndHashes;
};

export const downloadComponentDataWithCache = async (url: string) => {
  const response = await httpGetWithCache(url, BLOB_CACHE_NAME);
  const data = await response.blob();
  const componentText = await data.text();
  // TODO: Validate the data
  const componentSpec = yaml.load(componentText) as ComponentSpec;
  return componentSpec;
};

export const cacheAllComponents = async (users = ["kubeflow", "Ark-kun"]) => {
  console.debug("Starting cacheAllComponents");
  const urlsAndHashesIterator = getComponentUrlsAndHashes(users);

  // const cache = await caches.open(BLOB_CACHE_NAME);
  const urlToHashDb = localForage.createInstance({
    name: DB_NAME,
    storeName: URL_TO_HASH_DB_TABLE_NAME,
  });
  const hashToUrlDb = localForage.createInstance({
    name: DB_NAME,
    storeName: HASH_TO_URL_DB_TABLE_NAME,
  });
  const hashToContentDb = localForage.createInstance({
    name: DB_NAME,
    storeName: HASH_TO_CONTENT_DB_TABLE_NAME,
  });
  const hashToComponentNameDb = localForage.createInstance({
    name: DB_NAME,
    storeName: HASH_TO_COMPONENT_NAME_DB_TABLE_NAME,
  });
  const urlProcessingVersionDb = localForage.createInstance({
    name: DB_NAME,
    storeName: URL_PROCESSING_VERSION_TABLE_NAME,
  });
  const badHashesDb = localForage.createInstance({
    name: DB_NAME,
    storeName: BAD_HASHES_TABLE_NAME,
  });
  for await (const item of urlsAndHashesIterator) {
    const hash = item.hash.toLowerCase();
    const htmlUrl = item.url;
    const badHashReason = await badHashesDb.getItem<string>(hash);
    if (badHashReason !== null) {
      console.debug(
        `Skipping url ${htmlUrl} with hash ${hash} due to error: "${badHashReason}"`
      );
      continue;
    }
    try {
      const downloadUrl: string = githubHtmlUrlToDownloadUrl(htmlUrl);
      if (!downloadUrl.endsWith("component.yaml")) {
        console.debug(
          `Skipping url ${downloadUrl} since it does not end with "component.yaml"`
        );
        continue;
      }
      // Sanity check
      const cachedHash = await urlToHashDb.getItem<string>(downloadUrl);
      if (cachedHash !== null && cachedHash !== hash) {
        console.error(
          `Component cache is broken. Stored hash for ${downloadUrl}: ${cachedHash} != ${hash}.`
        );
      }
      // Check whether the processing is complete
      const urlVersion = await urlProcessingVersionDb.getItem<string>(
        downloadUrl
      );

      if (
        cachedHash !== null && // Not sure we should check this, but it improves the sanity
        urlVersion !== null &&
        Number.parseInt(urlVersion) >= CURRENT_URL_PROCESSING_VERSION
      ) {
        continue;
      }

      console.debug(`Processing new component candidate: ${downloadUrl}.`);
      const response = await httpGetWithCache(downloadUrl, BLOB_CACHE_NAME);
      let componentSpec: ComponentSpec;
      let componentText: string;
      try {
        const data = await response.blob();
        componentText = await data.text();
        // TODO: Validate the data
        componentSpec = yaml.load(componentText) as ComponentSpec;
      } catch (err) {
        badHashesDb.setItem(hash, err.name + ": " + err.message);
        continue;
      }
      if (componentSpec.implementation === undefined) {
        badHashesDb.setItem(
          hash,
          'Component lacks the "implementation" section.'
        );
        continue;
      }

      // Blobs are cumbersome (need await to get text) - store text instead
      // await hashToContentDb.setItem(hash, data);
      await hashToContentDb.setItem(hash, componentText);

      // Only adding hash -> URL once
      const urlForHash = await hashToUrlDb.getItem<string>(hash);
      if (urlForHash === null) {
        await hashToUrlDb.setItem(hash, downloadUrl);
      }

      // Only storing names when they exist
      if (componentSpec.name) {
        await hashToComponentNameDb.setItem(hash, componentSpec.name);
      }

      await urlToHashDb.setItem(downloadUrl, hash);

      // Marking the processing as completed
      await urlProcessingVersionDb.setItem(
        downloadUrl,
        CURRENT_URL_PROCESSING_VERSION
      );
    } catch (err) {
      console.error(
        `Error when processing component candidate ${htmlUrl} Error: ${err}.`
      );
    }
  }
  console.debug("Finished cacheAllComponents");
};

export const getAllComponentsAsRefs = async (
  users = ["kubeflow", "Ark-kun"]
) => {
  // Perhaps use urlProcessingVersionDb as source of truth. Hmm. It is URL-based
  const hashToUrlDb = localForage.createInstance({
    name: DB_NAME,
    storeName: HASH_TO_URL_DB_TABLE_NAME,
  });
  const hashToContentDb = localForage.createInstance({
    name: DB_NAME,
    storeName: HASH_TO_CONTENT_DB_TABLE_NAME,
  });
  let hashToComponentRef = new Map<string, ComponentReference>();

  const cachePromise = cacheAllComponents(users);
  if ((await hashToContentDb.length()) === 0) {
    await cachePromise;
  }

  // !!! Iterating using hashToContentDb.iterate<string, void> causes all values to be `[object Blob]`
  //await hashToContentDb.iterate<Blob, void>(
  await hashToContentDb.iterate<string, void>(
    // !!! async processor causes only 1 item to be processed since it returns Promise instead of undefined.
    //async (componentData, hash, iterationNumber) => {
    (componentText, hash, iterationNumber) => {
      //const componentText = await componentData.text();
      try {
        const componentSpec = yaml.load(componentText) as ComponentSpec;
        hashToComponentRef.set(hash, {
          spec: componentSpec,
        });
      } catch (err) {
        console.error(
          `Error when parsing cached component. Hash: ${hash}. Error: ${err}. Component text: ${componentText}`
        );
      }
    }
  );
  await hashToUrlDb.iterate<string, void>((url, hash, iterationNumber) => {
    let componentRef = hashToComponentRef.get(hash);
    if (componentRef === undefined) {
      console.error(
        `Component db corrupted: Component with url ${url} and hash ${hash} has no content in the DB.`
      );
    } else {
      componentRef.url = url;
    }
  });
  let componentRefs: ComponentReference[] = [];
  // TODO: Improve the iteration once TypeScript property supports it
  hashToComponentRef.forEach((componentRef, hash) => {
    if (componentRef.url === undefined) {
      console.error(
        `Component db corrupted: Component with hash ${hash} has content, but no URL in the DB.`
      );
    } else {
      componentRefs.push(componentRef);
    }
  });
  return componentRefs;
};

export const searchComponentsByName = async (
  name: string,
  users = ["kubeflow", "Ark-kun"]
) => {
  const componentRefs = await getAllComponentsAsRefs(users);
  return componentRefs.filter(
    (ref) => ref.spec?.name?.toLowerCase().includes(name.toLowerCase()) ?? false
  );
};
