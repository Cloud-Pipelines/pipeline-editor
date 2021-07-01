import React, { DragEvent, useEffect, useState } from 'react';

import {downloadComponentDataWithCache} from '../github'
import {ComponentSpec, TaskSpec} from '../componentSpec'
import ComponentLibrary from './ComponentLibrary'
import GraphComponentExporter from './GraphComponentExporter'
import GoogleCloudSubmitter from './GoogleCloud'
import VertexAiExporter from './VertexAiExporter'

const onDragStart = (event: DragEvent, nodeData: object) => {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
  event.dataTransfer.effectAllowed = 'move';
};

const COMPONENT_LIBRARY = [
  {
    category: "Quick start",
    componentUrls: [
      'https://raw.githubusercontent.com/Ark-kun/pipelines/60a2612541ec08c6a85c237d2ec7525b12543a43/components/datasets/Chicago_Taxi_Trips/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/567c04c51ff00a1ee525b3458425b17adbe3df61/components/XGBoost/Train/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/567c04c51ff00a1ee525b3458425b17adbe3df61/components/XGBoost/Predict/component.yaml',
    ]
  },
  {
    category: "Datasets", componentUrls: [
      'https://raw.githubusercontent.com/Ark-kun/pipelines/60a2612541ec08c6a85c237d2ec7525b12543a43/components/datasets/Chicago_Taxi_Trips/component.yaml',
    ]
  },
  {
    category: "Data manipulation",
    componentUrls: [
      'https://raw.githubusercontent.com/Ark-kun/pipelines/6162d55998b176b50267d351241100bb0ee715bc/components/pandas/Transform_DataFrame/in_CSV_format/component.yaml',
    ]
  },
  {
    category: "Upload/Download",
    componentUrls: [
    'https://raw.githubusercontent.com/Ark-kun/pipelines/54ac9a6a7173aecbbb30a043b2077e790cac6953/components/web/Download/component.yaml',
    'https://raw.githubusercontent.com/Ark-kun/pipelines/2dac60c400ad8767b452649d08f328dfaf230f96/components/google-cloud/storage/download/component.yaml',
    'https://raw.githubusercontent.com/Ark-kun/pipelines/2dac60c400ad8767b452649d08f328dfaf230f96/components/google-cloud/storage/upload_to_unique_uri/component.yaml',
    'https://raw.githubusercontent.com/Ark-kun/pipelines/2dac60c400ad8767b452649d08f328dfaf230f96/components/google-cloud/storage/upload_to_explicit_uri/component.yaml',
    ]
  },
  {
    category: "XGBoost",
    componentUrls: [
      'https://raw.githubusercontent.com/Ark-kun/pipelines/567c04c51ff00a1ee525b3458425b17adbe3df61/components/XGBoost/Train/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/567c04c51ff00a1ee525b3458425b17adbe3df61/components/XGBoost/Predict/component.yaml',
    ]
  },
  {
    category: "PyTorch",
    componentUrls: [
      'https://raw.githubusercontent.com/Ark-kun/pipelines/4e1facea1a270535b515a9e8cc59422d1ad76a9e/components/PyTorch/Create_fully_connected_network/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/603342c4b88fe2d69ff07682f702cd3601e883bb/components/PyTorch/Train_PyTorch_model/from_CSV/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/e011e4affa85542ef2b24d63fdac27f8d939bbee/components/PyTorch/Convert_to_OnnxModel_from_PyTorchScriptModule/component.yaml',
    ]
  },
  {
    category: "TFX",
    componentUrls: [
    ]
  },
];

const Sidebar = () => {
  const [componentSpec, setComponentSpec] = useState<ComponentSpec | undefined>(undefined);

  const componentUrl = "https://raw.githubusercontent.com/kubeflow/pipelines/603342c4b88fe2d69ff07682f702cd3601e883bb/components/PyTorch/Train_PyTorch_model/from_CSV/component.yaml";
  useEffect(() => {
    downloadComponentDataWithCache(componentUrl).then(setComponentSpec);
  }, []);

  return (
    <aside className="nodeList">
      <details open style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "8px", fontWeight: "bold" }}>Submit to Google Cloud</summary>
        <GoogleCloudSubmitter/>
      </details>
      <div className="description">You can drag these nodes to the pane on the right.</div>
      <div className="react-flow__node-input" onDragStart={(event: DragEvent) => onDragStart(event, { input: { label: "Input Node" } })} draggable>
        Input Node
      </div>
      <div className="react-flow__node-output" onDragStart={(event: DragEvent) => onDragStart(event, { output: { label: "Output Node" } })} draggable>
        Output Node
      </div>
      <ComponentLibrary componentGroups={COMPONENT_LIBRARY}/>
      <GraphComponentExporter/>
      <VertexAiExporter/>
      <details>
        <summary>Legacy nodes</summary>
          <div className="react-flow__node-default" onDragStart={(event: DragEvent) => onDragStart(event, { default: { label: "Default Node" } })} draggable>
            Default Node
          </div>
          <div className="react-flow__node react-flow__node-multihandle" draggable
          onDragStart={(event: DragEvent) =>
            onDragStart(event, { multihandle: {
              handles: {
                top: { type: "target", ids: ["top_1", "top_2", "top_3"] },
                bottom: { type: "source", ids: ["bottom_1", "bottom_2"] },
                left: { type: "target", ids: ["left_1"] },
                right: { type: "source", ids: ["right_1"] },
              },
              label: "Multi-handle node (3-2-1-1)",
            }})
          }
        >
          Multi-port Node 3-2-1-1
        </div>
        <div className="react-flow__node react-flow__node-multihandle" draggable
          onDragStart={(event: DragEvent) => {
            // Using await inside onDragStart breaks event.dataTransfer.setData! 
            //const componentSpec = await loadComponentFromUrl("https://raw.githubusercontent.com/kubeflow/pipelines/603342c4b88fe2d69ff07682f702cd3601e883bb/components/PyTorch/Train_PyTorch_model/from_CSV/component.yaml");
            if (componentSpec === undefined) {
              return;
            }
            const inputs = componentSpec.inputs ?? []
            const inputNames = inputs.map(inputSpec => inputSpec.name);
            const outputs = componentSpec.outputs ?? []
            const outputNames = outputs.map(outputSpec => outputSpec.name);
            const componentName = componentSpec.name ?? "Component"
            return onDragStart(event, { multihandle: {
              handles: {
                top: { type: "target", ids: inputNames },
                bottom: { type: "source", ids: outputNames },
              },
              label: componentName,
            }});
          }}
        >
          PyTorch/Train_PyTorch_model/from_CSV
        </div>
        {
          componentSpec !== undefined && <div className="react-flow__node react-flow__node-multihandle" draggable
            onDragStart={(event: DragEvent) => {
              const taskSpec: TaskSpec = {
                componentRef: {
                  url: componentUrl,
                  spec: componentSpec,
                },
              };
              return onDragStart(event, { task: taskSpec});
            }}
          >
            {componentSpec.name}
          </div>
        }
      </details>
    </aside>
  );
};

export default Sidebar;
