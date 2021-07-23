import yaml from "js-yaml";
import localForage from "localforage";

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

export interface ComponentReferenceWithSpec extends ComponentReference {
  spec: ComponentSpec;
  digest: string;
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
  return componentRef;
};

export const loadComponentAsRefFromUrl = async (url: string) => {
  const response = await fetch(url);
  const componentData = await response.arrayBuffer();
  let componentRef = await loadComponentAsRefFromText(componentData);
  componentRef.url = url;
  return componentRef;
};

export const storeComponentText = async (
  componentText: string | ArrayBuffer
) => {
  const componentBytes =
    typeof componentText === "string"
      ? new TextEncoder().encode(componentText)
      : componentText;
  const componentRef = await loadComponentAsRefFromText(componentText);
  const digestToComponentTextDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_DATA_DB_TABLE_NAME,
  });
  await digestToComponentTextDb.setItem(componentRef.digest, componentBytes);
  await storeComponentSpec(componentRef.digest, componentRef.spec);

  return componentRef;
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

  const existingDigest = await urlToDigestDb.getItem<string>(url);
  if (existingDigest !== null) {
    const componentSpec = await digestToComponentSpecDb.getItem<ComponentSpec>(
      existingDigest
    );
    if (componentSpec !== null) {
      const componentRef: ComponentReferenceWithSpec = {
        url: url,
        digest: existingDigest,
        spec: componentSpec,
      };
      return componentRef;
    } else {
      console.error(
        `Component db is corrupted: Component with url ${url} was added before with digest ${existingDigest} but now has no content in the DB.`
      );
    }
  }

  const response = await fetch(url);
  const componentData = await response.arrayBuffer();
  let componentRef = await storeComponentText(componentData);
  componentRef.url = url;
  const digest = componentRef.digest;
  if (digest === undefined) {
    console.error(
      `Cannot happen: storeComponentText has returned componentReference with digest === undefined.`
    );
    return componentRef;
  }
  if (digest !== existingDigest) {
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
  return componentRef;
};

export const addComponentRefToList = async (
  listName: string,
  componentRef: ComponentReferenceWithSpec
) => {
  const componentRefListsDb = localForage.createInstance({
    name: DB_NAME,
    storeName: COMPONENT_REF_LISTS_DB_TABLE_NAME,
  });
  let componentRefList: ComponentReferenceWithSpec[] =
    (await componentRefListsDb.getItem(listName)) ?? [];
  componentRefList.push(componentRef);
  await componentRefListsDb.setItem(listName, componentRefList);
  return componentRef;
};

export const addComponentToListByUrl = async (
  listName: string,
  url: string
) => {
  const componentRef = await storeComponentFromUrl(url);
  return addComponentRefToList(listName, componentRef);
};

export const addComponentToListByText = async (
  listName: string,
  componentText: string | ArrayBuffer
) => {
  const componentRef = await storeComponentText(componentText);
  return addComponentRefToList(listName, componentRef);
};

export const resetComponentList = async (listName: string, componentRefs: ComponentReferenceWithSpec[]) => {
  const componentRefListsDb = localForage.createInstance({
    name: DB_NAME,
    storeName: COMPONENT_REF_LISTS_DB_TABLE_NAME,
  });
  await componentRefListsDb.setItem(listName, componentRefs);
};

export const getAllComponentsFromList = async (listName: string) => {
  const componentRefListsDb = localForage.createInstance({
    name: DB_NAME,
    storeName: COMPONENT_REF_LISTS_DB_TABLE_NAME,
  });
  const componentRefList: ComponentReferenceWithSpec[] =
    (await componentRefListsDb.getItem(listName)) ?? [];
  return componentRefList;
};
