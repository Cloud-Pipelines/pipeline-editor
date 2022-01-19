/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import yaml from "js-yaml";
import localForage from "localforage";
import { ComponentSearchConfig } from "./appSettings";
import { httpGetWithCache } from "./cacheUtils";
import {
  ComponentSpec,
  ComponentReference,
  isValidComponentSpec,
} from "./componentSpec";
import { preloadComponentReferences } from "./DragNDrop/samplePipelines";

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

const getSingleGitHubCodeSearchPageWithCache = async (
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

async function* searchComponentsOnGitHubToGetUrlsAndHashes(
  searchLocations: string[]
) {
  let urlsAndHashes: UrlAndHash[] = [];
  // TODO: If the number of components exceeds 1000 we should issue separate query for each location.
  // TODO: Perhaps try to filter by component contents (inputValue, inputPath, outputPath, graph, implementation)
  const queryParts = ["filename:component.yaml"].concat(searchLocations);
  const query = queryParts.join(" ");
  for (let page = 1; page < 100; page++) {
    const searchResults = await getSingleGitHubCodeSearchPageWithCache(
      query,
      page
    );
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

const searchComponentsOnGitHubAndCacheCandidateBlobs = async (
  searchLocations: string[]
): Promise<any[]> => {
  let urlsAndHashes: UrlAndHash[] = [];
  let urls = [];
  for await (const urlAndHash of searchComponentsOnGitHubToGetUrlsAndHashes(
    searchLocations
  )) {
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
  const componentSpecObj = yaml.load(componentText);
  if (typeof componentSpecObj !== "object" || componentSpecObj === null) {
    throw Error(
      `componentText is not a YAML-encoded object: ${componentSpecObj}`
    );
  }
  if (!isValidComponentSpec(componentSpecObj)) {
    throw Error(
      `componentText does not encode a valid pipeline component: ${componentSpecObj}`
    );
  }
  const componentSpec = componentSpecObj;
  return componentSpec;
};

const importComponentsFromGitHubSearch = async (searchLocations: string[]) => {
  console.debug("Starting importComponentsFromGitHubSearch");
  const urlsAndHashesIterator =
    searchComponentsOnGitHubToGetUrlsAndHashes(searchLocations);

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
        const componentSpecObj = yaml.load(componentText);
        if (typeof componentSpecObj !== "object" || componentSpecObj === null) {
          throw Error(
            `componentText is not a YAML-encoded object: ${componentSpecObj}`
          );
        }
        if (!isValidComponentSpec(componentSpecObj)) {
          throw Error(
            `componentText does not encode a valid pipeline component: ${componentSpecObj}`
          );
        }
        componentSpec = componentSpecObj;
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
  console.debug("Finished importComponentsFromGitHubSearch");
};

interface ComponentFeedEntry {
  componentRef: ComponentReference;
  annotations?: {
    [k: string]: unknown;
  };
  data: string;
}

interface ComponentFeed {
  annotations?: {
    [k: string]: unknown;
  };
  components: ComponentFeedEntry[];
}

// Type guards
const isComponentFeedEntry = (obj: any): obj is ComponentFeedEntry =>
  "componentRef" in obj;

const isComponentFeedEntryArray = (obj: any): obj is ComponentFeedEntry[] =>
  Array.isArray(obj) && obj.every(isComponentFeedEntry);

const isComponentFeed = (obj: any): obj is ComponentFeed =>
  typeof obj === "object" &&
  "components" in obj &&
  isComponentFeedEntryArray(obj["components"]);

function notUndefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}

const calculateGitBlobSha1HashHex = async (data: string | ArrayBuffer) => {
  // TODO: Avoid string roundtrip
  const dataString =
    typeof data === "string" ? data : new TextDecoder().decode(data);
  const gitDataString =
    "blob " + dataString.length.toString() + "\0" + dataString;
  const gitDataBytes = new TextEncoder().encode(gitDataString);
  const hashBuffer = await crypto.subtle.digest("SHA-1", gitDataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

const importComponentsFromFeed = async (componentFeedUrl: string) => {
  console.debug("Starting importComponentsFromFeed");
  console.debug(`Downloading component feed: ${componentFeedUrl}.`);
  const response = await fetch(componentFeedUrl);
  const componentFeedCandidateBlob = await response.blob();
  const componentFeedCandidateText = await componentFeedCandidateBlob.text();
  const componentFeedCandidateObject = yaml.load(componentFeedCandidateText);
  if (!isComponentFeed(componentFeedCandidateObject)) {
    throw new Error(
      `Component feed loaded from "${componentFeedUrl}" had invalid content inside.`
    );
  }
  const componentFeed = componentFeedCandidateObject;

  const urlsHashesAndData = (
    await Promise.all(
      componentFeed.components.map(async (entry) => {
        const url = entry.componentRef.url;
        if (url === undefined) {
          console.error("Component feed entry has no reference URL.");
          return undefined;
        }
        return {
          url: url,
          hash: await calculateGitBlobSha1HashHex(entry.data),
          data: entry.data,
        };
      })
    )
  ).filter(notUndefined);

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
  for await (const item of urlsHashesAndData) {
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
      const downloadUrl = item.url;
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
      let componentText = item.data;
      if (componentText === undefined) {
        const response = await httpGetWithCache(downloadUrl, BLOB_CACHE_NAME);
        try {
          const data = await response.blob();
          componentText = await data.text();
        } catch (err) {
          const error_message =
            err instanceof Error ? err.name + ": " + err.message : String(err);
          badHashesDb.setItem(hash, error_message);
          continue;
        }
      }
      const componentSpecObj = yaml.load(componentText);
      if (typeof componentSpecObj !== "object" || componentSpecObj === null) {
        throw Error(
          `componentText is not a YAML-encoded object: ${componentSpecObj}`
        );
      }
      if (!isValidComponentSpec(componentSpecObj)) {
        throw Error(
          `componentText does not encode a valid pipeline component: ${componentSpecObj}`
        );
      }
      const componentSpec = componentSpecObj;
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
  console.debug("Finished importComponentsFromFeed");
};

export const refreshComponentDb = async (
  componentSearchConfig: ComponentSearchConfig
) => {
  if (componentSearchConfig.ComponentFeedUrls) {
    for (const componentFeedUrl of componentSearchConfig.ComponentFeedUrls) {
      try {
        await importComponentsFromFeed(componentFeedUrl);
      } catch (error) {
        console.error(
          `Error importing component feed "${componentFeedUrl}": ${error}`
        );
      }
    }
  }
  if (componentSearchConfig.GitHubSearchLocations !== undefined) {
    await importComponentsFromGitHubSearch(
      componentSearchConfig.GitHubSearchLocations
    );
  }
};

export const getAllComponentsAsRefs = async () => {
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

  // !!! Iterating using hashToContentDb.iterate<string, void> causes all values to be `[object Blob]`
  //await hashToContentDb.iterate<Blob, void>(
  await hashToContentDb.iterate<string, void>(
    // !!! async processor causes only 1 item to be processed since it returns Promise instead of undefined.
    //async (componentData, hash, iterationNumber) => {
    (componentText, hash, iterationNumber) => {
      //const componentText = await componentData.text();
      try {
        const componentSpec = yaml.load(componentText) as ComponentSpec;
        preloadComponentReferences(componentSpec);
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

export const isComponentDbEmpty = async () => {
  const hashToContentDb = localForage.createInstance({
    name: DB_NAME,
    storeName: HASH_TO_CONTENT_DB_TABLE_NAME,
  });
  return (await hashToContentDb.length()) === 0;
};

export const searchComponentsByName = async (name: string) => {
  const componentRefs = await getAllComponentsAsRefs();
  return componentRefs.filter(
    (ref) => ref.spec?.name?.toLowerCase().includes(name.toLowerCase()) ?? false
  );
};
