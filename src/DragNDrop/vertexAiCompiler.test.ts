/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import { ComponentSpec } from "../componentSpec";
import { generateVertexPipelineJobFromGraphComponent } from "./vertexAiCompiler";
import { PipelineJob } from "./vertexPipelineSpec";

test("generateVertexPipelineJobFromGraphComponent compiles Data_passing_pipeline", () => {
  const pipelineText = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "./testData/Data_passing_pipeline/pipeline.component.yaml"
      )
    )
    .toString();
  const expectedCompiledPipelineText = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "./testData/Data_passing_pipeline/google_cloud_vertex_pipeline.json"
      )
    )
    .toString();
  const pipelineSpec = yaml.load(pipelineText) as ComponentSpec;
  const expectedVertexPipelineJob = JSON.parse(
    expectedCompiledPipelineText
  ) as PipelineJob;
  const compiledVertexPipelineJob = generateVertexPipelineJobFromGraphComponent(
    pipelineSpec,
    "gs://some-bucket/",
    new Map(
      Object.entries({
        anything_param: "anything_param",
        something_param: "something_param",
        string_param: "string_param_override",
      })
    )
  );
  expect(compiledVertexPipelineJob).toEqual(expectedVertexPipelineJob);
});
