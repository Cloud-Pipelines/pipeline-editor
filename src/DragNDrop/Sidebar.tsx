import { DragEvent } from 'react';

import ComponentLibrary from './ComponentLibrary'
import ComponentSearch from './ComponentSearch'
import GraphComponentExporter from './GraphComponentExporter'
import GoogleCloudSubmitter from './GoogleCloud'
import VertexAiExporter from './VertexAiExporter'
import { ComponentSpec } from '../componentSpec';
import { loadComponentFromUrl, DATA_PASSING_PIPELINE_URL } from './samplePipelines';
import UserComponentLibrary from "./UserComponentLibrary";
import PipelineLibrary from "./PipelineLibrary";

const onDragStart = (event: DragEvent, nodeData: object) => {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
  event.dataTransfer.setData(
    "DragStart.offset",
    JSON.stringify({
      offsetX: event.nativeEvent.offsetX,
      offsetY: event.nativeEvent.offsetY,
    })
  );
  event.dataTransfer.effectAllowed = 'move';
};

const COMPONENT_LIBRARY = [
  {
    category: "Quick start",
    componentUrls: [
      // 'https://raw.githubusercontent.com/Ark-kun/pipelines/60a2612541ec08c6a85c237d2ec7525b12543a43/components/datasets/Chicago_Taxi_Trips/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/2463ecda532517462590d75e6e14a8af6b55869a/components/datasets/Chicago_Taxi_Trips/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/567c04c51ff00a1ee525b3458425b17adbe3df61/components/XGBoost/Train/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/567c04c51ff00a1ee525b3458425b17adbe3df61/components/XGBoost/Predict/component.yaml',
    ]
  },
  {
    category: "Datasets", componentUrls: [
      // 'https://raw.githubusercontent.com/Ark-kun/pipelines/60a2612541ec08c6a85c237d2ec7525b12543a43/components/datasets/Chicago_Taxi_Trips/component.yaml',
      'https://raw.githubusercontent.com/Ark-kun/pipelines/2463ecda532517462590d75e6e14a8af6b55869a/components/datasets/Chicago_Taxi_Trips/component.yaml',
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
      'https://raw.githubusercontent.com/kubeflow/pipelines/9b0d47a226c61f96e1ebe7a8ba427df38f8734e1/components/deprecated/tfx/ExampleGen/CsvExampleGen/component.yaml',
      'https://raw.githubusercontent.com/kubeflow/pipelines/9b0d47a226c61f96e1ebe7a8ba427df38f8734e1/components/deprecated/tfx/StatisticsGen/component.yaml',
      'https://raw.githubusercontent.com/kubeflow/pipelines/9b0d47a226c61f96e1ebe7a8ba427df38f8734e1/components/deprecated/tfx/SchemaGen/component.yaml',
      'https://raw.githubusercontent.com/kubeflow/pipelines/9b0d47a226c61f96e1ebe7a8ba427df38f8734e1/components/deprecated/tfx/ExampleValidator/component.yaml',
      'https://raw.githubusercontent.com/kubeflow/pipelines/9b0d47a226c61f96e1ebe7a8ba427df38f8734e1/components/deprecated/tfx/Transform/component.yaml',
      'https://raw.githubusercontent.com/kubeflow/pipelines/9b0d47a226c61f96e1ebe7a8ba427df38f8734e1/components/deprecated/tfx/Trainer/component.yaml',
      'https://raw.githubusercontent.com/kubeflow/pipelines/9b0d47a226c61f96e1ebe7a8ba427df38f8734e1/components/deprecated/tfx/Evaluator/component.yaml',
    ]
  },
];

interface SidebarProps {
  componentSpec?: ComponentSpec,
  setComponentSpec?: (componentSpec: ComponentSpec) => void,
}

const Sidebar = ({
  componentSpec,
  setComponentSpec
}: SidebarProps) => {
  return (
    <aside className="nodeList">
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Save/Load pipeline</summary>
        <PipelineLibrary componentSpec={componentSpec} setComponentSpec={setComponentSpec}/>
      </details>
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Submit to Google Cloud</summary>
        <GoogleCloudSubmitter componentSpec={componentSpec}/>
      </details>
      <h3>Drag components to the canvas:</h3>
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary><strong>Special</strong></summary>
        <div className="react-flow__node react-flow__node-input sidebar-node" onDragStart={(event: DragEvent) => onDragStart(event, { input: { label: "Input" } })} draggable>
          Input
        </div>
        <div className="react-flow__node react-flow__node-output sidebar-node" onDragStart={(event: DragEvent) => onDragStart(event, { output: { label: "Output" } })} draggable>
          Output
        </div>
      </details>
      <ComponentLibrary componentGroups={COMPONENT_LIBRARY}/>
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>User components</summary>
        <UserComponentLibrary/>
      </details>
      <details open style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Component search</summary>
        <ComponentSearch />
      </details>
      <details>
        <summary>Debug</summary>
        {componentSpec && <GraphComponentExporter componentSpec={componentSpec}/>}
        {componentSpec && <VertexAiExporter componentSpec={componentSpec}/>}
        <button
          type="button"
          onClick={(e) => {
            loadComponentFromUrl(DATA_PASSING_PIPELINE_URL).then(setComponentSpec);
          }}
        >
          Load Data Passing pipeline
        </button>
      </details>
    </aside>
  );
};

export default Sidebar;
