/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

export const COMPONENT_LIBRARY = [
  {
    category: "Quick start",
    componentUrls: [
      // 'https://raw.githubusercontent.com/Ark-kun/pipelines/60a2612541ec08c6a85c237d2ec7525b12543a43/components/datasets/Chicago_Taxi_Trips/component.yaml',
      "https://raw.githubusercontent.com/Ark-kun/pipelines/2463ecda532517462590d75e6e14a8af6b55869a/components/datasets/Chicago_Taxi_Trips/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/XGBoost/Train/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/XGBoost/Predict/component.yaml",
    ],
  },
  {
    category: "Datasets",
    componentUrls: [
      // 'https://raw.githubusercontent.com/Ark-kun/pipelines/60a2612541ec08c6a85c237d2ec7525b12543a43/components/datasets/Chicago_Taxi_Trips/component.yaml',
      "https://raw.githubusercontent.com/Ark-kun/pipelines/2463ecda532517462590d75e6e14a8af6b55869a/components/datasets/Chicago_Taxi_Trips/component.yaml",
    ],
  },
  {
    category: "Data manipulation",
    componentUrls: [
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/pandas/Transform_DataFrame/in_CSV_format/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/dataset_manipulation/split_data_into_folds/in_CSV/component.yaml",
      // JSON
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Build_dict/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Build_list/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Build_list_of_strings/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Build_list_of_integers/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Build_list_of_floats/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Combine_lists/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Get_element_by_index/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Get_element_by_key/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/json/Query/component.yaml",
    ],
  },
  {
    category: "Upload/Download",
    componentUrls: [
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/web/Download/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/google-cloud/storage/download/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/google-cloud/storage/upload_to_unique_uri/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/google-cloud/storage/upload_to_explicit_uri/component.yaml",
    ],
  },
  {
    category: "XGBoost",
    componentUrls: [
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/XGBoost/Train/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/XGBoost/Predict/component.yaml",
    ],
  },
  {
    category: "PyTorch",
    componentUrls: [
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/PyTorch/Create_fully_connected_network/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/PyTorch/Train_PyTorch_model/from_CSV/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/PyTorch/Convert_to_OnnxModel_from_PyTorchScriptModule/component.yaml",
    ],
  },
  {
    category: "TFX",
    componentUrls: [
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/deprecated/tfx/ExampleGen/CsvExampleGen/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/deprecated/tfx/StatisticsGen/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/deprecated/tfx/SchemaGen/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/deprecated/tfx/ExampleValidator/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/deprecated/tfx/Transform/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/deprecated/tfx/Trainer/component.yaml",
      "https://raw.githubusercontent.com/Ark-kun/pipeline_components/47f3621344c884666a926c8a15d77562f1cc5e0a/components/deprecated/tfx/Evaluator/component.yaml",
    ],
  },
];
