/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import yaml from "js-yaml";
import localForage from "localforage";
import { DownloadDataType, downloadDataWithCache } from "./cacheUtils";

import {
  ComponentSpec,
  ComponentReference,
  isValidComponentSpec,
} from "./componentSpec";

// IndexedDB: DB and table names
const DB_NAME = "components";
const DIGEST_TO_DATA_DB_TABLE_NAME = "digest_to_component_data";
const DIGEST_TO_COMPONENT_SPEC_DB_TABLE_NAME = "digest_to_component_spec";
const DIGEST_TO_COMPONENT_NAME_DB_TABLE_NAME = "digest_to_component_name";
const URL_TO_DIGEST_DB_TABLE_NAME = "url_to_digest";
const DIGEST_TO_CANONICAL_URL_DB_TABLE_NAME = "digest_to_canonical_url";
const COMPONENT_REF_LISTS_DB_TABLE_NAME = "component_ref_lists";
const COMPONENT_STORE_SETTINGS_DB_TABLE_NAME = "component_store_settings";
const FILE_STORE_DB_TABLE_NAME_PREFIX = "file_store_";

export interface ComponentReferenceWithSpec extends ComponentReference {
  spec: ComponentSpec;
  digest: string;
}

export interface ComponentReferenceWithSpecPlusData {
  componentRef: ComponentReferenceWithSpec;
  data: ArrayBuffer;
}

const calculateHashDigestHex = async (data: string | ArrayBuffer) => {
  const dataBytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

const storeComponentSpec = async (
  digest: string,
  componentSpec: ComponentSpec
) => {
  const digestToComponentSpecDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_COMPONENT_SPEC_DB_TABLE_NAME,
  });
  const digestToComponentNameDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_COMPONENT_NAME_DB_TABLE_NAME,
  });
  await digestToComponentSpecDb.setItem(digest, componentSpec);
  if (componentSpec.name !== undefined) {
    await digestToComponentNameDb.setItem(digest, componentSpec.name);
  }
};

export const loadComponentAsRefFromText = async (
  componentText: string | ArrayBuffer
) => {
  const componentString =
    typeof componentText === "string"
      ? componentText
      : new TextDecoder().decode(componentText);
  const componentBytes =
    typeof componentText === "string"
      ? new TextEncoder().encode(componentText)
      : componentText;

  const loadedObj = yaml.load(componentString);
  if (typeof loadedObj !== "object" || loadedObj === null) {
    throw Error(`componentText is not a YAML-encoded object: ${loadedObj}`);
  }
  if (!isValidComponentSpec(loadedObj)) {
    throw Error(
      `componentText does not encode a valid pipeline component: ${loadedObj}`
    );
  }
  const componentSpec: ComponentSpec = loadedObj;

  const digest = await calculateHashDigestHex(componentBytes);
  const componentRef: ComponentReferenceWithSpec = {
    spec: componentSpec,
    digest: digest,
  };
  const componentRefPlusData: ComponentReferenceWithSpecPlusData = {
    componentRef: componentRef,
    data: componentBytes,
  };
  return componentRefPlusData;
};

export const loadComponentFromUrlAsRefPlusData = async (
  url: string,
  downloadData: DownloadDataType = downloadDataWithCache
) => {
  const componentRefPlusData = await downloadData(
    url,
    loadComponentAsRefFromText
  );
  componentRefPlusData.componentRef.url = url;
  return componentRefPlusData;
};

export const preloadComponentReferences = async (
  componentSpec: ComponentSpec,
  downloadData: DownloadDataType = downloadDataWithCache,
  componentMap?: Map<string, ComponentSpec>
) => {
  // This map is needed to improve efficiency and handle recursive components.
  if (componentMap === undefined) {
    componentMap = new Map<string, ComponentSpec>();
  }
  if ("graph" in componentSpec.implementation) {
    for (const taskSpec of Object.values(
      componentSpec.implementation.graph.tasks
    )) {
      const componentUrl = taskSpec.componentRef.url;
      if (
        taskSpec.componentRef.spec === undefined &&
        componentUrl !== undefined
      ) {
        let taskComponentSpec = componentMap.get(componentUrl);
        if (taskComponentSpec === undefined) {
          const taskComponentRefPlusData =
            await loadComponentFromUrlAsRefPlusData(componentUrl, downloadData);
          taskComponentSpec = taskComponentRefPlusData.componentRef.spec;
          componentMap.set(componentUrl, taskComponentSpec);
        }
        taskSpec.componentRef.spec = taskComponentSpec;
        await preloadComponentReferences(
          taskComponentSpec,
          downloadData,
          componentMap
        );
      }
    }
  }
  return componentSpec;
};

export const fullyLoadComponentFromUrl = async (
  url: string,
  downloadData: DownloadDataType = downloadDataWithCache
) => {
  const componentRefPlusData = await loadComponentFromUrlAsRefPlusData(
    url,
    downloadData
  );
  const componentSpec = await preloadComponentReferences(
    componentRefPlusData.componentRef.spec,
    downloadData
  );
  return componentSpec;
};

export const storeComponentText = async (
  componentText: string | ArrayBuffer
) => {
  const componentBytes =
    typeof componentText === "string"
      ? new TextEncoder().encode(componentText)
      : componentText;
  const componentRefPlusData = await loadComponentAsRefFromText(componentText);
  const digestToComponentTextDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_DATA_DB_TABLE_NAME,
  });
  const componentRef = componentRefPlusData.componentRef;
  await digestToComponentTextDb.setItem(
    componentRefPlusData.componentRef.digest,
    componentBytes
  );
  await storeComponentSpec(componentRef.digest, componentRef.spec);

  return componentRefPlusData;
};

export const getAllComponentsAsRefs = async () => {
  const digestToComponentSpecDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_COMPONENT_SPEC_DB_TABLE_NAME,
  });

  // TODO: Rewrite as async generator
  let digestToComponentRef = new Map<string, ComponentReferenceWithSpec>();
  await digestToComponentSpecDb.iterate<ComponentSpec, void>(
    (componentSpec, digest, iterationNumber) => {
      const componentRef: ComponentReferenceWithSpec = {
        spec: componentSpec,
        digest: digest,
      };
      digestToComponentRef.set(digest, componentRef);
    }
  );
  await addCanonicalUrlsToComponentReferences(digestToComponentRef);

  const componentRefs = Array.from(digestToComponentRef.values());
  return componentRefs;
};

const addCanonicalUrlsToComponentReferences = async (
  digestToComponentRef: Map<string, ComponentReference>
) => {
  const digestToCanonicalUrlDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_CANONICAL_URL_DB_TABLE_NAME,
  });
  await digestToCanonicalUrlDb.iterate<string, void>(
    (url, digest, iterationNumber) => {
      let componentRef = digestToComponentRef.get(digest);
      if (componentRef === undefined) {
        console.error(
          `Component db corrupted: Component with url ${url} and digest ${digest} has no content in the DB.`
        );
      } else {
        componentRef.url = url;
      }
    }
  );
};

export const searchComponentsByName = async (name: string) => {
  const componentRefs = await getAllComponentsAsRefs();
  return componentRefs.filter(
    (ref) => ref.spec.name?.toLowerCase().includes(name.toLowerCase()) ?? false
  );
};

export const storeComponentFromUrl = async (
  url: string,
  setUrlAsCanonical = false
) => {
  const urlToDigestDb = localForage.createInstance({
    name: DB_NAME,
    storeName: URL_TO_DIGEST_DB_TABLE_NAME,
  });
  const digestToComponentSpecDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_COMPONENT_SPEC_DB_TABLE_NAME,
  });
  const digestToDataDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_DATA_DB_TABLE_NAME,
  });

  const existingDigest = await urlToDigestDb.getItem<string>(url);
  if (existingDigest !== null) {
    const componentSpec = await digestToComponentSpecDb.getItem<ComponentSpec>(
      existingDigest
    );
    const componentData = await digestToDataDb.getItem<ArrayBuffer>(
      existingDigest
    );
    if (componentSpec !== null && componentData !== null) {
      const componentRef: ComponentReferenceWithSpec = {
        url: url,
        digest: existingDigest,
        spec: componentSpec,
      };
      const componentRefPlusData: ComponentReferenceWithSpecPlusData = {
        componentRef: componentRef,
        data: componentData,
      };
      return componentRefPlusData;
    } else {
      console.error(
        `Component db is corrupted: Component with url ${url} was added before with digest ${existingDigest} but now has no content in the DB.`
      );
    }
  }

  // TODO: Think about whether to directly use fetch here.
  const response = await fetch(url);
  const componentData = await response.arrayBuffer();
  let componentRefPlusData = await storeComponentText(componentData);
  let componentRef = componentRefPlusData.componentRef;
  componentRef.url = url;
  const digest = componentRef.digest;
  if (digest === undefined) {
    console.error(
      `Cannot happen: storeComponentText has returned componentReference with digest === undefined.`
    );
    return componentRefPlusData;
  }
  if (existingDigest !== null && digest !== existingDigest) {
    console.error(
      `Component db is corrupted: Component with url ${url} previously had digest ${existingDigest} but now has digest ${digest}.`
    );
  }
  const digestToCanonicalUrlDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_CANONICAL_URL_DB_TABLE_NAME,
  });
  const existingCanonicalUrl = await digestToCanonicalUrlDb.getItem<string>(
    digest
  );
  if (existingCanonicalUrl === null) {
    await digestToCanonicalUrlDb.setItem(digest, url);
  } else {
    if (url !== existingCanonicalUrl) {
      console.debug(
        `The component with digest "${digest}" is being loaded from "${url}", but was previously loaded from "${existingCanonicalUrl}".` +
          (setUrlAsCanonical ? " Changing the canonical url." : "")
      );
      if (setUrlAsCanonical) {
        await digestToCanonicalUrlDb.setItem(digest, url);
      }
    }
  }
  // Updating the urlToDigestDb last, because it's used to check for cached entries.
  // So we need to be sure that everything has been updated correctly.
  await urlToDigestDb.setItem(url, digest);
  return componentRefPlusData;
};

interface ComponentFileEntryV2 {
  componentRef: ComponentReferenceWithSpec;
}

interface FileEntry {
  name: string;
  creationTime: Date;
  modificationTime: Date;
  data: ArrayBuffer;
}

interface ComponentFileEntryV3
  extends FileEntry,
    ComponentReferenceWithSpecPlusData {}

export type ComponentFileEntry = ComponentFileEntryV3;

const makeNameUniqueByAddingIndex = (
  name: string,
  existingNames: Set<string>
): string => {
  let finalName = name;
  let index = 1;
  while (existingNames.has(finalName)) {
    index++;
    finalName = name + " " + index.toString();
  }
  return finalName;
};

const writeComponentRefPlusDataToFile = async (
  listName: string,
  fileName: string,
  componentRefPlusData: ComponentReferenceWithSpecPlusData
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  const existingFile = await componentListDb.getItem<ComponentFileEntry>(
    fileName
  );
  const currentTime = new Date();
  let fileEntry: ComponentFileEntry;
  if (existingFile === null) {
    fileEntry = {
      componentRef: componentRefPlusData.componentRef,
      name: fileName,
      creationTime: currentTime,
      modificationTime: currentTime,
      data: componentRefPlusData.data,
    };
  } else {
    fileEntry = {
      ...existingFile,
      name: fileName,
      modificationTime: currentTime,
      data: componentRefPlusData.data,
      componentRef: componentRefPlusData.componentRef,
    };
  }
  await componentListDb.setItem(fileName, fileEntry);
  return fileEntry;
};

const addComponentRefPlusDataToList = async (
  listName: string,
  componentRefPlusData: ComponentReferenceWithSpecPlusData,
  fileName: string = "Component"
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  const existingNames = new Set<string>(await componentListDb.keys());
  const uniqueFileName = makeNameUniqueByAddingIndex(fileName, existingNames);
  return writeComponentRefPlusDataToFile(
    listName,
    uniqueFileName,
    componentRefPlusData
  );
};

export const addComponentToListByUrl = async (
  listName: string,
  url: string,
  defaultFileName: string = "Component"
) => {
  const componentRefPlusData = await storeComponentFromUrl(url);
  return addComponentRefPlusDataToList(
    listName,
    componentRefPlusData,
    componentRefPlusData.componentRef.spec.name ?? defaultFileName
  );
};

export const addComponentToListByText = async (
  listName: string,
  componentText: string | ArrayBuffer,
  fileName?: string,
  defaultFileName: string = "Component"
) => {
  const componentRefPlusData = await storeComponentText(componentText);
  return addComponentRefPlusDataToList(
    listName,
    componentRefPlusData,
    fileName ?? componentRefPlusData.componentRef.spec.name ?? defaultFileName
  );
};

export const writeComponentToFileListFromText = async (
  listName: string,
  fileName: string,
  componentText: string | ArrayBuffer
) => {
  const componentRefPlusData = await storeComponentText(componentText);
  return writeComponentRefPlusDataToFile(
    listName,
    fileName,
    componentRefPlusData
  );
};

export const getAllComponentsFromList = async (listName: string) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  let componentRefs: ComponentReferenceWithSpec[] = [];
  await componentListDb.iterate<ComponentFileEntry, void>(
    (fileEntry, fileName, iterationNumber) => {
      componentRefs.push(fileEntry.componentRef);
    }
  );
  return componentRefs;
};

export const getAllComponentFilesFromList = async (listName: string) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  let componentFiles = new Map<string, ComponentFileEntry>();
  await componentListDb.iterate<ComponentFileEntry, void>(
    (fileEntry, fileName, iterationNumber) => {
      componentFiles.set(fileName, fileEntry);
    }
  );
  return componentFiles;
};

export const getComponentFileFromList = async (
  listName: string,
  fileName: string
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  return componentListDb.getItem<ComponentFileEntry>(fileName);
};

export const deleteComponentFileFromList = async (
  listName: string,
  fileName: string
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  return componentListDb.removeItem(fileName);
};

export const unsafeWriteFilesToList = async (listName: string, files: ComponentFileEntry[]) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  for (const file of files) {
    await componentListDb.setItem(file.name, file);
  }
};

export const componentSpecToYaml = (componentSpec: ComponentSpec) => {
  return yaml.dump(componentSpec, { lineWidth: 10000 });
};

// TODO: Remove the upgrade code in several weeks.
const upgradeSingleComponentListDb = async (listName: string) => {
  const componentListVersionKey = "component_list_format_version_" + listName;
  const componentStoreSettingsDb = localForage.createInstance({
    name: DB_NAME,
    storeName: COMPONENT_STORE_SETTINGS_DB_TABLE_NAME,
  });
  const componentListTableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: componentListTableName,
  });
  let listFormatVersion =
    (await componentStoreSettingsDb.getItem<number>(componentListVersionKey)) ??
    1;
  if (![1, 2, 3].includes(listFormatVersion)) {
    throw Error(
      `upgradeComponentListDb: Unknown component list version "${listFormatVersion}" for the list ${listName}`
    );
  }
  if (listFormatVersion === 1) {
    console.log(`componentStore: Upgrading the component list DB ${listName}`);
    const componentRefListsDb = localForage.createInstance({
      name: DB_NAME,
      storeName: COMPONENT_REF_LISTS_DB_TABLE_NAME,
    });
    const componentRefList: ComponentReferenceWithSpec[] =
      (await componentRefListsDb.getItem(listName)) ?? [];

    let existingNames = new Set<string>();
    const emptyNameReplacement =
      listName === "user_pipelines" ? "Pipeline" : "Component";
    for (const componentRef of componentRefList) {
      const fileName = componentRef.spec.name ?? emptyNameReplacement;
      const uniqueFileName = makeNameUniqueByAddingIndex(
        fileName,
        existingNames
      );
      const fileEntry: ComponentFileEntryV2 = {
        componentRef: componentRef,
      };
      await componentListDb.setItem(uniqueFileName, fileEntry);
      existingNames.add(uniqueFileName);
    }
    await componentStoreSettingsDb.setItem(componentListVersionKey, 2);
    listFormatVersion = 2;
    console.log(
      `componentStore: Upgraded the component list DB ${listName} to version ${listFormatVersion}`
    );
  }
  if (listFormatVersion === 2) {
    const digestToDataDb = localForage.createInstance({
      name: DB_NAME,
      storeName: DIGEST_TO_DATA_DB_TABLE_NAME,
    });
    const fileNames = await componentListDb.keys();
    for (const fileName of fileNames) {
      const fileEntry = await componentListDb.getItem<ComponentFileEntryV2>(
        fileName
      );
      if (fileEntry === null) {
        throw Error(`File "${fileName}" has disappeared during upgrade`);
      }
      let componentRef = fileEntry.componentRef;
      let data = await digestToDataDb.getItem<ArrayBuffer>(
        fileEntry.componentRef.digest
      );
      if (data === null) {
        console.error(
          `Db is corrupted: Could not find data for file "${fileName}" with digest ${fileEntry.componentRef.digest}.`
        );
        const componentText = componentSpecToYaml(fileEntry.componentRef.spec);
        data = new TextEncoder().encode(componentText);
        const newDigest = await calculateHashDigestHex(data);
        componentRef.digest = newDigest;
        console.warn(
          `The component "${fileName}" was re-serialized. Old digest: ${fileEntry.componentRef.digest}. New digest ${newDigest}.`
        );
        // This case should not happen. Let's throw error for now.
        throw Error(
          `Db is corrupted: Could not find data for file "${fileName}" with digest ${fileEntry.componentRef.digest}.`
        );
      }
      const currentTime = new Date();
      const newFileEntry: ComponentFileEntryV3 = {
        name: fileName,
        creationTime: currentTime,
        modificationTime: currentTime,
        data: data,
        componentRef: componentRef,
      };
      await componentListDb.setItem(fileName, newFileEntry);
    }
    listFormatVersion = 3;
    await componentStoreSettingsDb.setItem(
      componentListVersionKey,
      listFormatVersion
    );
    console.log(
      `componentStore: Upgraded the component list DB ${listName} to version ${listFormatVersion}`
    );
  }
};
