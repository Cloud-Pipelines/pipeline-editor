/* global gapi */

import { useState } from 'react';

import { ArgumentType, ComponentSpec } from '../componentSpec';
import {generateVertexPipelineJobFromGraphComponent} from './vertexAiCompiler'
import ArgumentsEditor from "./ArgumentsEditor";

const LOCAL_STORAGE_GCS_OUTPUT_DIRECTORY_KEY = "GoogleCloudSubmitter/gcsOutputDirectory";
const LOCAL_STORAGE_PROJECT_ID_KEY = "GoogleCloudSubmitter/projectId";
const LOCAL_STORAGE_REGION_KEY = "GoogleCloudSubmitter/region";
const LOCAL_STORAGE_PROJECT_IDS_KEY = "GoogleCloudSubmitter/projectIds";

var CLIENT_ID = '640001104961-2m8hs192tmd9f9nssbr5thr5o3uhmita.apps.googleusercontent.com';
var API_KEY = 'AIzaSyCDPTffgYGXoit-jKsj1_1WWbSxvU7aEdQ';
     
const VERTEX_AI_PIPELINES_REGIONS = [
  'us-central1',
  'europe-west4',
  'asia-east1',
];

const VERTEX_AI_PIPELINES_DEFAULT_REGION = 'us-central1';

const authorizeGoogleCloudClient = async (
  scopes: string[],
  immediate = false, // Setting immediate to true prevents auth window showing every time. But it needs to be false the first time (when cookies are not set).
  apiKey: string = API_KEY,
  clientId: string = CLIENT_ID,
) => {
  return new Promise<GoogleApiOAuth2TokenObject>(
    (resolve, reject) => {
      gapi.client.setApiKey(apiKey);
      gapi.auth.authorize(
        {
          client_id: clientId,
          scope: scopes,
          immediate: immediate,
        },
        (authResult) => {
          // console.debug("authorizeGoogleCloudClient: called back");
          if (authResult === undefined) {
            console.error("authorizeGoogleCloudClient failed");
            reject("gapi.auth.authorize result is undefined");
          } else if (authResult.error) {
            console.error(
              "authorizeGoogleCloudClient failed",
              authResult.error
            );
            reject(authResult.error);
          } else {
            // console.debug("authorizeGoogleCloudClient: Success");
            // Working around the Google Auth bug: The request succeeds, but the returned token does not have the requested scopes.
            // See https://github.com/google/google-api-javascript-client/issues/743
            const receivedScopesString = (authResult as any).scope as string | undefined;
            const receivedScopes = receivedScopesString?.split(" ");
            if (receivedScopes === undefined || !scopes.every((scope) => receivedScopes.includes(scope))) {
              const errorMessage = `Authorization call succeeded, but the returned scopes are ${receivedScopesString}`;
              console.error(errorMessage);
              reject(errorMessage);
            } else {
              resolve(authResult);
            }
          }
        }
      );
    }
  );
};

const ensureGoogleCloudAuthorizesScopes = async (scopes: string[]) => {
  try {
    // console.debug('Before ensureGoogleCloudAuthorizesScopes(immediate=true)');
    await authorizeGoogleCloudClient(scopes, true);
    // console.debug('After ensureGoogleCloudAuthorizesScopes(immediate=true)');
    (window as any).gtag?.("event", "GoogleCloud_auth", {
      result: "succeeded",
      immediate: "true"
    });
  } catch (err) {
    // console.error('ensureGoogleCloudAuthorizesScopes(immediate=true)', err);
    try {
      await authorizeGoogleCloudClient(scopes, false);
      (window as any).gtag?.("event", "GoogleCloud_auth", {
        result: "succeeded",
        immediate: "false"
      });
    } catch (err) {
      // console.error('ensureGoogleCloudAuthorizesScopes(immediate=false)', err);
      (window as any).gtag?.("event", "GoogleCloud_auth", {
        result: "failed",
        immediate: "false"
      });
    }
  }
};

const cloudresourcemanagerListProjects = async (isAuthenticated = false) => {
  await ensureGoogleCloudAuthorizesScopes(
    ["https://www.googleapis.com/auth/cloud-platform"]
  );
  const response = await gapi.client.request({
    path: "https://cloudresourcemanager.googleapis.com/v1/projects/",
  });
  return response.result;
}

const aiplatformCreatePipelineJob = async (projectId: string, region='us-central1', pipelineJob: Record<string, any>) => {
  await ensureGoogleCloudAuthorizesScopes(
    ["https://www.googleapis.com/auth/cloud-platform"]
  );
  const response = await gapi.client.request({
    path: `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/pipelineJobs`,
    method: "POST",
    body: JSON.stringify(pipelineJob),
  });
  (window as any).gtag?.("event", "GoogleCloud_submit_pipeline_job", {
    result: "succeeded"
  });
  return response.result;
}

interface GoogleCloudSubmitterProps {
  componentSpec?: ComponentSpec,
};

const GoogleCloudSubmitter = ({
  componentSpec,
}: GoogleCloudSubmitterProps) => {
  const [projects, setProjects] = useState<string[]>(
    () => JSON.parse(window.localStorage?.getItem(LOCAL_STORAGE_PROJECT_IDS_KEY) ?? "[]")
  );
  const [project, setProject] = useState<string>(
    () => window.localStorage?.getItem(LOCAL_STORAGE_PROJECT_ID_KEY) ?? ""
  ); // undefined causes error: https://reactjs.org/docs/forms.html#controlled-components https://stackoverflow.com/a/47012342
  const [region, setRegion] = useState(
    () => window.localStorage?.getItem(LOCAL_STORAGE_REGION_KEY) ?? VERTEX_AI_PIPELINES_DEFAULT_REGION
  );
  const [error, setError] = useState("");
  const [gcsOutputDirectory, setGcsOutputDirectory] = useState(
    () => window.localStorage?.getItem(LOCAL_STORAGE_GCS_OUTPUT_DIRECTORY_KEY) ?? ""
  );
  const [pipelineJobWebUrl, setPipelineJobWebUrl] = useState("");
  const [compilationError, setCompilationError] = useState("");
  const [componentArguments, setComponentArguments] = useState<Record<string, ArgumentType>>({});

  let vertexPipelineJobJson: string | undefined = undefined;
  let vertexPipelineJob: Record<string, any> | undefined = undefined;

  //useEffect(() => {
  if (componentSpec !== undefined) {
    const defaultInputValues = Object.fromEntries(
      (componentSpec.inputs ?? [])
        .filter((inputSpec) => inputSpec.default !== undefined)
        .map((inputSpec) => [inputSpec.name, String(inputSpec.default)])
    );
    const pipelineArguments = {
      ...defaultInputValues,
      ...componentArguments,
    };
    const pipelineArgumentMap = new Map(
      Object.entries(pipelineArguments).filter(
        // Type guard predicate
        (pair): pair is [string, string] => typeof pair[1] === "string"
      )
    );
    try {
      vertexPipelineJob = generateVertexPipelineJobFromGraphComponent(
        componentSpec,
        gcsOutputDirectory,
        pipelineArgumentMap
      );
      vertexPipelineJobJson = JSON.stringify(vertexPipelineJob, undefined, 2);
      // Prevent infinite re-renders
      if (compilationError !== "") {
        setCompilationError("");
      }
    } catch (err) {
      const errorMessage = err.toString();
      // Prevent infinite re-renders
      if (errorMessage !== compilationError) {
        setCompilationError(err.toString());
      }
    }
  }
  //}, [componentSpec, gcsOutputDirectory]);

  const vertexPipelineJobUrl = vertexPipelineJobJson && URL.createObjectURL(
    new Blob([vertexPipelineJobJson], { type: "application/json" })
  );

  const readyToSubmit =
    project !== "" && region !== "" && vertexPipelineJob !== undefined;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (vertexPipelineJob === undefined) {
          return;
        }
        setPipelineJobWebUrl("");
        try {
          // setItem might throw exception on iOS in incognito mode
          try {
            window.localStorage?.setItem(LOCAL_STORAGE_GCS_OUTPUT_DIRECTORY_KEY, gcsOutputDirectory);
            window.localStorage?.setItem(LOCAL_STORAGE_PROJECT_ID_KEY, project);
            window.localStorage?.setItem(LOCAL_STORAGE_REGION_KEY, region);
          } catch(err) {
            console.error("GoogleCloudSubmitter: Error writing properties to the localStorage", err);
          }
          const result = await aiplatformCreatePipelineJob(project, region, vertexPipelineJob);
          const pipelineJobName: string = result.name;
          const pipelineJobId = pipelineJobName.split('/').slice(-1)[0];
          const pipelineJobWebUrl = `https://console.cloud.google.com/vertex-ai/locations/${region}/pipelines/runs/${pipelineJobId}?project=${project}`;
          setPipelineJobWebUrl(pipelineJobWebUrl);
          setError("");
        } catch (err) {
          console.error(err);
          setError(err?.result?.error?.message ?? "Error");
          (window as any).gtag?.("event", "GoogleCloud_submit_pipeline_job", {
            result: "failed"
          });
        }
      }}
    >
      {componentSpec === undefined ||
      (componentSpec?.inputs?.length ?? 0) === 0 ? undefined : (
        <fieldset
          style={{
            // Reduce the default padding
            padding: "2px",
          }}
        >
          <legend>Arguments</legend>
          <ArgumentsEditor
            componentSpec={componentSpec}
            componentArguments={componentArguments}
            setComponentArguments={setComponentArguments}
            shrinkToWidth={true}
          />
        </fieldset>
      )}
      <div style={{
        whiteSpace: "nowrap",
        margin: "5px",
      }}>
        <label htmlFor="project">Project: </label>
        <input
          id="project"
          required
          type="text"
          list="projects"
          placeholder="<my-project-id>"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
        <datalist id="projects">
          {projects.map((projectId) => (
            <option key={projectId} value={projectId} />
          ))}
        </datalist>
        <button
          type="button" // The default button type is "submit", not "button". WTF!?
          onClick={async (e) => {
            try {
              const result = await cloudresourcemanagerListProjects();
              const projectIds = (result.projects as any[]).map<string>(
                (projectInfo) => projectInfo.projectId
              );
              setProjects(projectIds);
              setError("");
              try {
                window.localStorage?.setItem(LOCAL_STORAGE_PROJECT_IDS_KEY, JSON.stringify(projectIds));
              } catch(err) {
                console.error("GoogleCloudSubmitter: Error writing properties to the localStorage", err);
              }
              (window as any).gtag?.("event", "GoogleCloud_list_projects", { result: "succeeded" });
            } catch (err) {
              setError(err?.result?.error?.message ?? "Error");
              (window as any).gtag?.("event", "GoogleCloud_list_projects", { result: "failed" });
            }
          }}
        >
          ⟳{/* 🗘⭯ ⭮ ↺ ↻ ⟲ ⟳ 🔃🔄 */}
        </button>
      </div>
      <div style={{
        whiteSpace: "nowrap",
        margin: "5px",
      }}>
        <label htmlFor="region">Region: </label>
        <input
          id="region"
          required
          type="text"
          list="regions"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
        <datalist id="regions">
          {VERTEX_AI_PIPELINES_REGIONS.map((region) => (
            <option key={region} value={region} />
          ))}
        </datalist>
      </div>
      <div style={{
        whiteSpace: "nowrap",
        margin: "5px",
      }}>
        <label htmlFor="region">GCS dir: </label>
        <input
          id="gcsOutputDirectory"
          required
          type="text"
          value={gcsOutputDirectory}
          onChange={(e) => setGcsOutputDirectory(e.target.value)}
        />
      </div>
      <input
        type="submit"
        disabled={!readyToSubmit}
        value="Submit pipeline job"
      />
      {pipelineJobWebUrl !== "" && <div><a href={pipelineJobWebUrl} target="_blank" rel="noreferrer">Job</a></div>}
      {vertexPipelineJobUrl !== undefined && (
        <div style={{
          whiteSpace: "nowrap",
          margin: "5px",
        }}>
          Download <a
            href={vertexPipelineJobUrl}
            download={"vertex_pipeline_job.json"}
          >
            vertex_pipeline_job.json
          </a>
        </div>
      )}
      {compilationError !== "" && <div>{compilationError}</div>}
      {error !== "" && <div>Error: {error}</div>}
    </form>
  );
};

export default GoogleCloudSubmitter;
