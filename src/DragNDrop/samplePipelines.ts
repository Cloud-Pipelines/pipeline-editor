import { ComponentSpec } from "../componentSpec";
import { downloadComponentDataWithCache } from "../github";

const TFX_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/2765b13699ac28de523f499eeaa9eb2ed9b8798a/components/deprecated/tfx/_samples/TFX.pipeline.component.yaml"
const XGBOOST_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/77df9c97191a181fcd3cded83f147799d46eca20/components/XGBoost/_samples/sample_pipeline.pipeline.component.yaml"
const PYTORCH_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/322c0c75f32d87acfd5da9c390dee0b5799bfdaf/components/PyTorch/_samples/Train_fully-connected_network.pipeline.component.yaml"
export const DATA_PASSING_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/b45c82e42588ee0a86b8875d1908d972275bfd2f/samples/test/data_passing.pipeline.component.yaml"

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

export { loadComponentFromUrl, preloadComponentReferences, XGBOOST_PIPELINE_URL, PYTORCH_PIPELINE_URL, TFX_PIPELINE_URL };
