import { ComponentSpec } from "../componentSpec";
import { downloadComponentDataWithCache } from "../github";

const TFX_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/2765b13699ac28de523f499eeaa9eb2ed9b8798a/components/deprecated/tfx/_samples/TFX.pipeline.component.yaml"
const XGBOOST_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/77df9c97191a181fcd3cded83f147799d46eca20/components/XGBoost/_samples/sample_pipeline.pipeline.component.yaml"
const PYTORCH_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/322c0c75f32d87acfd5da9c390dee0b5799bfdaf/components/PyTorch/_samples/Train_fully-connected_network.pipeline.component.yaml"

let xgBoostQueryTrainPredictPipeline = {
  name: "XGBoost query train predict pipeline",
  inputs: [],
  outputs: [],
  implementation: {
    graph: {
      tasks: {
        dataset: {
          componentRef: {
            url: "https://raw.githubusercontent.com/Ark-kun/pipelines/60a2612541ec08c6a85c237d2ec7525b12543a43/components/datasets/Chicago_Taxi_Trips/component.yaml",
          },
          annotations: {
            "editor.position": '{"x":100,"y":100,"width":180,"height":40}',
          },
          arguments: {
            Select: 'tips,trip_seconds,trip_miles,pickup_community_area,dropoff_community_area,fare,tolls,extras,trip_total',
            Where: 'trip_start_timestamp >= "2019-01-01" AND trip_start_timestamp < "2019-02-01"'
          }
        },
        train: {
          componentRef: {
            url: "https://raw.githubusercontent.com/Ark-kun/pipelines/567c04c51ff00a1ee525b3458425b17adbe3df61/components/XGBoost/Train/component.yaml",
          },
          annotations: {
            "editor.position": '{"x":100,"y":200,"width":180,"height":40}',
          },
          arguments: {
            training_data: {
              taskOutput: {
                taskId: "dataset",
                outputName: "Table",
              },
            },
          },
        },
        predict: {
          componentRef: {
            url: "https://raw.githubusercontent.com/Ark-kun/pipelines/567c04c51ff00a1ee525b3458425b17adbe3df61/components/XGBoost/Predict/component.yaml",
          },
          annotations: {
            "editor.position": '{"x":100,"y":300,"width":180,"height":40}',
          },
          arguments: {
            data: {
              taskOutput: {
                taskId: "dataset",
                outputName: "Table",
              },
            },
            model: {
              taskOutput: {
                taskId: "train",
                outputName: "model",
              },
            },
            label_column: "0",
          },
        },
      },
    },
  },
};

const preloadComponentReferences = async (
  componentSpec: ComponentSpec,
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
          taskComponentSpec = await downloadComponentDataWithCache(
            componentUrl
          );
          componentMap.set(componentUrl, taskComponentSpec);
        }
        taskSpec.componentRef.spec = taskComponentSpec;
        await preloadComponentReferences(taskComponentSpec, componentMap);
      }
    }
  }
  return componentSpec;
};

const loadComponentFromUrl = async (
  url: string,
  preloadChildComponentSpecs = true
) => {
  let componentSpec = await downloadComponentDataWithCache(url);
  if (preloadChildComponentSpecs) {
    componentSpec = await preloadComponentReferences(componentSpec);
  }
  return componentSpec;
};

export { loadComponentFromUrl, preloadComponentReferences, xgBoostQueryTrainPredictPipeline, XGBOOST_PIPELINE_URL, PYTORCH_PIPELINE_URL, TFX_PIPELINE_URL };
