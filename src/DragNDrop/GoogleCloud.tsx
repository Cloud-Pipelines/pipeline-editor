/* global gapi */

import { useState } from 'react';

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
  return new Promise<gapi.auth.GoogleApiOAuth2TokenObject>(
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

const aiplatformListPipelineJobs = async (projetId: string, region='us-central1', isAuthenticated = false) => {
  await ensureGoogleCloudAuthorizesScopes(
    ["https://www.googleapis.com/auth/cloud-platform"]
  );
  const response = await gapi.client.request({
    path: `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projetId}/locations/${region}/pipelineJobs`,
  });
  return response.result;
}

const GoogleCloudSubmitter = () => {
  const [projects, setProjects] = useState<string[]>([]);
  const [project, setProject] = useState<string>(""); // undefined causes error: https://reactjs.org/docs/forms.html#controlled-components https://stackoverflow.com/a/47012342
  const [region, setRegion] = useState(VERTEX_AI_PIPELINES_DEFAULT_REGION);
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          const result = await aiplatformListPipelineJobs(project, region);
          console.log("aiplatformListPipelineJobs result:", result);
          setError("");
        } catch (err) {
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
              setError(err);
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
      <input type="submit" value="List Pipelines" />
      {error !== "" && <div>Error: {error}</div>}
    </form>
  );
};

export default GoogleCloudSubmitter;
