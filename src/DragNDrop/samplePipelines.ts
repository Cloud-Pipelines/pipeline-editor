import { ComponentSpec } from "../componentSpec";
import { downloadComponentDataWithCache } from "../github";

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

export { preloadComponentReferences, xgBoostQueryTrainPredictPipeline };
