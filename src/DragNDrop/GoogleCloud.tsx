/* global gapi */

import { useState } from 'react';

import {
  useStoreState,
} from "react-flow-renderer";

import {createGraphComponentSpecFromFlowElements} from './graphComponentFromFlow'
import {generateVertexPipelineJobFromGraphComponent} from './vertexAiCompiler'

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
            resolve(authResult);
            // console.debug("authorizeGoogleCloudClient: Success");
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
  } catch (err) {
    // console.error('ensureGoogleCloudAuthorizesScopes(immediate=true)', err);
    try {
      await authorizeGoogleCloudClient(scopes, false);
    } catch (err) {
      // console.error('ensureGoogleCloudAuthorizesScopes(immediate=false)', err);
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

const aiplatformCreatePipelineJob = async (projetId: string, region='us-central1', pipelineJob: Record<string, any>) => {
  await ensureGoogleCloudAuthorizesScopes(
    ["https://www.googleapis.com/auth/cloud-platform"]
  );
  const response = await gapi.client.request({
    path: `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projetId}/locations/${region}/pipelineJobs`,
    method: "POST",
    body: JSON.stringify(pipelineJob),
  });
  return response.result;
}

const GoogleCloudSubmitter = () => {
  const [projects, setProjects] = useState<string[]>([]);
  const [project, setProject] = useState<string>(""); // undefined causes error: https://reactjs.org/docs/forms.html#controlled-components https://stackoverflow.com/a/47012342
  const [region, setRegion] = useState(VERTEX_AI_PIPELINES_DEFAULT_REGION);
  const [error, setError] = useState("");
  const [gcsOutputDirectory, setGcsOutputDirectory] = useState("");
  const [pipelineJobWebUrl, setPipelineJobWebUrl] = useState("");

  const nodes = useStoreState((store) => store.nodes);
  const edges = useStoreState((store) => store.edges);

  let vertexPipelineJobJson: string | undefined = undefined;
  let vertexPipelineJobUrl: string | undefined = undefined;
  try {
    const pipelineName = "Pipeline";
  
    const graphComponent = createGraphComponentSpecFromFlowElements(nodes, edges, pipelineName, undefined, false, true);
    const vertexPipelineJob = generateVertexPipelineJobFromGraphComponent(graphComponent, gcsOutputDirectory);
    vertexPipelineJobJson = JSON.stringify(vertexPipelineJob, undefined, 4);
    vertexPipelineJobUrl = URL.createObjectURL(
      new Blob([vertexPipelineJobJson], { type: "application/json" })
    );
  } catch(err) {
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const pipelineName = "Pipeline";

          const graphComponent = createGraphComponentSpecFromFlowElements(nodes, edges, pipelineName, undefined, false, true);
          const vertexPipelineJob = generateVertexPipelineJobFromGraphComponent(graphComponent, gcsOutputDirectory);
          const result = await aiplatformCreatePipelineJob(project, region, vertexPipelineJob);
          const pipelineJobName: string = result.name;
          const pipelineJobId = pipelineJobName.split('/').slice(-1)[0];
          const pipelineJobWebUrl = `https://console.cloud.google.com/vertex-ai/locations/${region}/pipelines/runs/${pipelineJobId}?project=${project}`;
          setPipelineJobWebUrl(pipelineJobWebUrl);
        } catch (err) {
          console.error(err);
          setPipelineJobWebUrl("");
          setError(err?.result?.error?.message ?? "Error");
        }
      }}
    >
      <div>
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
            } catch (err) {
              setError(err?.result?.error?.message ?? "Error");
            }
          }}
        >
          ⟳{/* 🗘⭯ ⭮ ↺ ↻ ⟲ ⟳ 🔃🔄 */}
        </button>
      </div>
      <div>
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
      <div>
        <label htmlFor="region">GCS dir: </label>
        <input
          id="gcsOutputDirectory"
          required
          type="text"
          value={gcsOutputDirectory}
          onChange={(e) => setGcsOutputDirectory(e.target.value)}
        />
      </div>
      <input type="submit" value="Submit pipeline job" />
      {pipelineJobWebUrl !== "" && <div><a href={pipelineJobWebUrl}>Job</a></div>}
      {vertexPipelineJobUrl !== undefined && (
        <div>
          Download <a
            href={vertexPipelineJobUrl}
            download={"vertex_pipeline_job.json"}
          >
            vertex_pipeline_job.json
          </a>
        </div>
      )}
      {error !== "" && <div>Error: {error}</div>}
    </form>
  );
};

export default GoogleCloudSubmitter;
