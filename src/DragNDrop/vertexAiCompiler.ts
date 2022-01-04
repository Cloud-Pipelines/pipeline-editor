/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import {
  ArgumentType,
  ComponentSpec,
  StringOrPlaceholder,
  TypeSpecType,
  isContainerImplementation,
  isGraphImplementation,
  InputSpec,
} from "../componentSpec";

import * as vertex from "./vertexPipelineSpec";

// # How to handle I/O:
// Rules (might have exceptions)
// output = output artifact
// inputValue => input parameter
// inputPath => input artifact
// # Fixing conflicts:
// 1) Artifact (may only come from task output) is consumed as value.
//   Solution 1) (implemented): Change input from parameter to artifact and use the input.artifact.value placeholder.
//      Cons: The downstream component input definitions depend on arguments. (Some inputs are changed from parameter to artifact.)
//   Solution 2): Add parameter output (with the same name as the artifact output) to the upstream component. The paths should be the same, so a single file will be treated as both parameter and output.
//      Cons: The upstream component output definitions depend on downstream consumption style. (Although parameter outputs are added, not changed.)
//   Solution 3): Insert a "Downloader" task between upstream and downstream.
//      Cons: Extra container task
// 2) Parameter (pipeline input or constant value) is consumed as artifact (as file).
//   Solution 1): Insert a "Uploader" task to convert parameter to artifact.
//      Cons: Extra container task

const sanitizePipelineInfoName = (pipelineContextName: string) => {
  return pipelineContextName.toLowerCase().replace(/\W/, "-");
};

type ResolvedCommandLineAndArgs = {
  command?: string[];
  args?: string[];
  inputsConsumedAsValue: Set<string>;
  inputsConsumedAsPath: Set<string>;
};

const resolveCommandLine = (
  componentSpec: ComponentSpec,
  taskArguments: Record<string, ArgumentType>,
  inputsThatHaveParameterArguments: Set<string>
): ResolvedCommandLineAndArgs => {
  if (!isContainerImplementation(componentSpec.implementation)) {
    throw Error("resolveCommandLine only supports container components");
  }
  const containerSpec = componentSpec.implementation.container;

  const inputsConsumedAsValue = new Set<string>();
  const inputsConsumedAsPath = new Set<string>();
  const convertArg = (arg: StringOrPlaceholder): string[] => {
    if (typeof arg == "string") {
      return [arg];
    } else if ("inputValue" in arg) {
      const inputName = arg.inputValue;
      if (!inputsThatHaveParameterArguments.has(inputName)) {
        // ! Important details:
        // In this branch, the argument comes from task output (or graph input with artifact argument).
        // All outputs are artifacts by default, so this argument is an artifact argument.
        // We can either try to change the argument to parameter or make the input to be an artifact to solve the conflict.
        // I choose to make the input to be artifact.
        // Adding input name to inputsConsumedAsPath to make the input rendered as an artifact input.
        inputsConsumedAsPath.add(inputName);
        return [`{{$.inputs.artifacts['${inputName}'].value}}`];
      } else {
        inputsConsumedAsValue.add(inputName);
        return [`{{$.inputs.parameters['${inputName}']}}`];
      }
    } else if ("inputPath" in arg) {
      const inputName = arg.inputPath;
      inputsConsumedAsPath.add(inputName);
      return [`{{$.inputs.artifacts['${inputName}'].path}}`];
    } else if ("outputPath" in arg) {
      const outputName = arg.outputPath;
      return [`{{$.outputs.artifacts['${outputName}'].path}}`];
    } else if ("if" in arg) {
      const [ifCond, ifThen, ifElse] = [arg.if.cond, arg.if.then, arg.if.else];
      // TODO: Check false values, not just check for true
      let condEvaluatesToTrue = false;
      if (typeof ifCond === "string") {
        condEvaluatesToTrue = ifCond.toLowerCase() === "true";
      } else if (typeof ifCond === "boolean") {
        condEvaluatesToTrue = ifCond;
      } else if ("isPresent" in ifCond) {
        const inputName = ifCond.isPresent;
        condEvaluatesToTrue = inputName in taskArguments;
      } else if ("inputValue" in ifCond) {
        const inputName = ifCond.inputValue;
        if (!(inputName in taskArguments)) {
          condEvaluatesToTrue = false;
        } else {
          const taskArgument = taskArguments[inputName];
          if (typeof taskArgument === "string") {
            condEvaluatesToTrue = taskArgument.toLowerCase() === "true";
          } else {
            throw Error(
              "Using runtime conditions in component command line placeholders is not supported yet."
            );
          }
        }
      } else {
        throw Error("Unexpected condition kind: " + ifCond);
      }
      const unresolvedArgs = condEvaluatesToTrue ? ifThen : ifElse;
      if (unresolvedArgs === undefined) {
        return [];
      }
      return unresolvedArgs.flatMap(convertArg);
    } else if ("concat" in arg) {
      const concatArgs = arg.concat;
      return [concatArgs.flatMap(convertArg).join("")];
    } else {
      throw Error(`Unknown kind of command-line argument: ${arg}`);
    }
  };

  const result = {
    command: containerSpec.command?.flatMap(convertArg),
    args: containerSpec.args?.flatMap(convertArg),
    inputsConsumedAsValue: inputsConsumedAsValue,
    inputsConsumedAsPath: inputsConsumedAsPath,
  };
  return result;
};

const typeSpecToVertexPrimitiveTypeEnum = (
  typeSpec: TypeSpecType | undefined
): vertex.PrimitiveTypeEnum => {
  if (typeof typeSpec === "string") {
    if (["integer"].includes(typeSpec.toLowerCase())) {
      return vertex.PrimitiveTypeEnum.INT;
    }
    if (["float", "double"].includes(typeSpec.toLowerCase())) {
      return vertex.PrimitiveTypeEnum.DOUBLE;
    }
  }
  return vertex.PrimitiveTypeEnum.STRING;
};

const typeSpecToVertexParameterSpec = (
  typeSpec: TypeSpecType | undefined
): vertex.InputParameterSpec => {
  return {
    type: typeSpecToVertexPrimitiveTypeEnum(typeSpec),
  };
};

const typeSpecToVertexArtifactTypeSchema = (
  typeSpec: TypeSpecType | undefined
): vertex.ArtifactTypeSchema => {
  // TODO: Implement better mapping
  const artifactTypeSchema = {
    schemaTitle: "system.Artifact",
  };
  return artifactTypeSchema;
};

const typeSpecToVertexArtifactSpec = (
  typeSpec: TypeSpecType | undefined
): vertex.InputArtifactSpec => {
  return {
    artifactType: typeSpecToVertexArtifactTypeSchema(typeSpec),
  };
};
// const typeSpecToVertexArtifactType(typeSpec: TypeSpecType) => {
//     return typeof typeSpec === "string" && ["String", "Integer", "Float", "Double", "Boolean", ]
// }

const stringToMlmdValue = (
  constantString: string,
  primitiveType: vertex.PrimitiveTypeEnum
): vertex.MlmdValue => {
  switch (primitiveType) {
    case vertex.PrimitiveTypeEnum.STRING:
      return {
        stringValue: constantString,
      };
    case vertex.PrimitiveTypeEnum.INT:
      return {
        intValue: parseInt(constantString),
      };
    case vertex.PrimitiveTypeEnum.DOUBLE:
      return {
        doubleValue: parseFloat(constantString),
      };
    default:
      throw Error(`Unknown primitive type ${primitiveType}`);
  }
};

const MAKE_ARTIFACT_COMPONENT_ID = "_make_artifact";
const MAKE_ARTIFACT_EXECUTOR_ID = "_make_artifact";
const MAKE_ARTIFACT_INPUT_NAME = "parameter";
const MAKE_ARTIFACT_OUTPUT_NAME = "artifact";

const buildMakeArtifactTaskSpec = (
  parameterArgumentSpec: vertex.ParameterArgumentSpec
): vertex.PipelineTaskSpec => {
  const taskSpec: vertex.PipelineTaskSpec = {
    componentRef: {
      name: MAKE_ARTIFACT_COMPONENT_ID,
    },
    taskInfo: {
      name: "Make artifact",
    },
    inputs: {
      parameters: {
        [MAKE_ARTIFACT_INPUT_NAME]: parameterArgumentSpec,
      },
    },
    cachingOptions: {
      enableCache: true,
    },
  };
  return taskSpec;
};

const makeArtifactComponentSpec: vertex.ComponentSpec = {
  executorLabel: MAKE_ARTIFACT_EXECUTOR_ID,
  inputDefinitions: {
    parameters: {
      [MAKE_ARTIFACT_INPUT_NAME]: {
        type: vertex.PrimitiveTypeEnum.STRING,
      },
    },
  },
  outputDefinitions: {
    artifacts: {
      [MAKE_ARTIFACT_OUTPUT_NAME]: {
        artifactType: {
          schemaTitle: "system.Artifact",
        },
      },
    },
  },
};

const makeArtifactExecutorSpec: vertex.ExecutorSpec = {
  container: {
    image: "alpine",
    command: [
      "sh",
      "-ec",
      'mkdir -p "$(dirname "$1")"; printf "%s" "$0" > "$1"',
      `{{$.inputs.parameters['${MAKE_ARTIFACT_INPUT_NAME}']}}`,
      `{{$.outputs.artifacts['${MAKE_ARTIFACT_OUTPUT_NAME}'].path}}`,
    ],
  },
};

function buildVertexParameterArgumentSpec(
  taskArgument: ArgumentType | undefined,
  inputSpec: InputSpec
) {
  if (taskArgument === undefined) {
    if (inputSpec.default !== undefined) {
      taskArgument = inputSpec.default;
    } else {
      if (inputSpec.optional === true) {
        // TODO: Decide what the behavior should be
        // throw Error(`Input "${inputSpec.name}" is optional, but command-line still uses it when when it's not present.`);
        console.error(
          `Input "${inputSpec.name}" is optional, but command-line still uses it when when it's not present.`
        );
        taskArgument = "";
      } else {
        throw Error(
          `Argument was not provided for required input "${inputSpec.name}"`
        );
      }
    }
  }
  let result: vertex.ParameterArgumentSpec;
  if (typeof taskArgument === "string") {
    result = {
      runtimeValue: {
        constantValue: stringToMlmdValue(
          taskArgument,
          typeSpecToVertexPrimitiveTypeEnum(inputSpec.type)
        ),
      },
    };
    return result;
  } else if ("graphInput" in taskArgument) {
    result = {
      componentInputParameter: taskArgument.graphInput.inputName,
    };
    return result;
  } else if ("taskOutput" in taskArgument) {
    result = {
      taskOutputParameter: {
        producerTask: taskArgument.taskOutput.taskId,
        outputParameterKey: taskArgument.taskOutput.outputName,
      },
    };
    return result;
  } else {
    throw Error(`Unknown kind of task argument: "${taskArgument}"`);
  }
}

function buildVertexArtifactArgumentSpec(
  taskArgument: ArgumentType | undefined,
  inputSpec: InputSpec,
  upstreamCannotBeArtifact: boolean,
  addMakeArtifactTaskAndGetArtifactArgumentSpec: (
    parameterArgumentSpec: vertex.ParameterArgumentSpec,
    namePrefix?: string
  ) => vertex.ArtifactArgumentSpec
) {
  //if (! (inputName in taskArguments)) {
  if (taskArgument === undefined) {
    // Checking for default value
    if (inputSpec.default !== undefined) {
      taskArgument = inputSpec.default;
    } else {
      if (inputSpec.optional === true) {
        // TODO: Decide what the behavior should be
        // throw Error(`Input "${inputSpec.name}" is optional, but command-line still uses it when when it's not present.`);
        console.error(
          `Input "${inputSpec.name}" is optional, but command-line still uses it when when it's not present.`
        );
        taskArgument = "";
      } else {
        throw Error(
          `Argument was not provided for required input "${inputSpec.name}"`
        );
      }
    }
  }
  let result: vertex.ArtifactArgumentSpec;
  if (typeof taskArgument === "string") {
    const parameterArgumentSpec: vertex.ParameterArgumentSpec = {
      runtimeValue: {
        constantValue: {
          // TODO: Check whether string is always OK here
          stringValue: taskArgument,
        },
      },
    };
    // TODO: Maybe use the taskArgument as part of the name?
    const convertedArtifactArgumentSpec =
      addMakeArtifactTaskAndGetArtifactArgumentSpec(
        parameterArgumentSpec,
        "Make artifact"
      );
    result = convertedArtifactArgumentSpec;
    return result;
  } else if ("graphInput" in taskArgument) {
    // Workaround for root DAG where all inputs must be parameters
    if (upstreamCannotBeArtifact) {
      const parameterArgumentSpec: vertex.ParameterArgumentSpec = {
        componentInputParameter: taskArgument.graphInput.inputName,
      };
      // We only need one task for each pipeline input parameter
      const convertedArtifactArgumentSpec =
        addMakeArtifactTaskAndGetArtifactArgumentSpec(
          parameterArgumentSpec,
          "Make artifact for " + taskArgument.graphInput.inputName
        );
      result = convertedArtifactArgumentSpec;
    } else {
      result = {
        componentInputArtifact: taskArgument.graphInput.inputName,
      };
    }
    return result;
  } else if ("taskOutput" in taskArgument) {
    result = {
      taskOutputArtifact: {
        producerTask: taskArgument.taskOutput.taskId,
        outputArtifactKey: taskArgument.taskOutput.outputName,
      },
    };
    return result;
  } else {
    throw Error(`Unknown kind of task argument: "${taskArgument}"`);
  }
}

const assertDefined = <T>(obj: T | undefined) => {
  if (obj === undefined) {
    throw TypeError("Object is undefined");
  }
  return obj;
};

const taskSpecToVertexTaskSpecComponentSpecAndExecutorSpec = (
  componentSpec: ComponentSpec,
  //passedArgumentNames: string[],
  taskArguments: Record<string, ArgumentType>,
  graphInputsWithParameterArguments: Set<string>,
  addExecutorAndGetId: (
    executor: vertex.ExecutorSpec,
    namePrefix?: string
  ) => string,
  addComponentAndGetId: (
    component: vertex.ComponentSpec,
    namePrefix?: string
  ) => string,
  addMakeArtifactTaskAndGetArtifactArgumentSpec: (
    parameterArgumentSpec: vertex.ParameterArgumentSpec,
    namePrefix?: string
  ) => vertex.ArtifactArgumentSpec
) => {
  if (!isContainerImplementation(componentSpec.implementation)) {
    // TODO: Support nested graph components
    throw Error("Nested graph components are not supported yet");
  }

  // So-called "parameter" arguments can either be constant arguments
  // or come from the arguments to the graph component of the current task.
  // In the current implementation the parameter arguments cannot come from task outputs since all task outputs are artifacts.
  const inputsThatHaveParameterArguments = new Set(
    (componentSpec.inputs ?? [])
      .map((inputSpec) => inputSpec.name)
      .filter((inputName) => {
        const taskArgument = taskArguments[inputName];
        if (taskArgument === undefined) {
          return false;
        }
        if (typeof taskArgument === "string") {
          return true;
        }
        if ("graphInput" in taskArgument) {
          if (
            graphInputsWithParameterArguments.has(
              taskArgument.graphInput.inputName
            )
          ) {
            return true;
          }
        }
        return false;
      })
  );

  const containerSpec = componentSpec.implementation.container;

  const resolvedCommandLine = resolveCommandLine(
    componentSpec,
    taskArguments,
    inputsThatHaveParameterArguments
  );

  const vertexExecutorSpec: vertex.ExecutorSpec = {
    container: {
      image: containerSpec.image,
      command: resolvedCommandLine.command,
      args: resolvedCommandLine.args,
    },
  };

  const vertexExecutorId = addExecutorAndGetId(
    vertexExecutorSpec,
    componentSpec.name ?? "Component"
  );

  const inputMap = new Map(
    (componentSpec.inputs ?? []).map((inputSpec) => [inputSpec.name, inputSpec])
  );

  const vertexComponentInputsSpec: vertex.ComponentInputsSpec = {
    parameters: Object.fromEntries(
      Array.from(resolvedCommandLine.inputsConsumedAsValue.values()).map(
        (inputName) => [
          inputName,
          typeSpecToVertexParameterSpec(inputMap.get(inputName)?.type),
        ]
      )
    ),
    artifacts: Object.fromEntries(
      Array.from(resolvedCommandLine.inputsConsumedAsPath.values()).map(
        (inputName) => [
          inputName,
          typeSpecToVertexArtifactSpec(inputMap.get(inputName)?.type),
        ]
      )
    ),
  };

  const vertexComponentOutputsSpec: vertex.ComponentOutputsSpec = {
    parameters: {}, // Parameters will be added later as needed
    artifacts: Object.fromEntries(
      (componentSpec.outputs ?? []).map((outputSpec) => [
        outputSpec.name,
        typeSpecToVertexArtifactSpec(outputSpec.type),
      ])
    ),
  };

  const vertexComponentSpec: vertex.ComponentSpec = {
    inputDefinitions: vertexComponentInputsSpec,
    outputDefinitions: vertexComponentOutputsSpec,
    // dag
    executorLabel: vertexExecutorId,
  };

  const vertexComponentId = addComponentAndGetId(
    vertexComponentSpec,
    componentSpec.name ?? "Component"
  );

  const vertexTaskParameterArguments = Object.fromEntries(
    Object.keys(vertexComponentInputsSpec.parameters ?? {}).map((inputName) => [
      inputName,
      buildVertexParameterArgumentSpec(
        taskArguments[inputName],
        assertDefined(inputMap.get(inputName))
      ),
    ])
  );

  const vertexTaskArtifactArguments = Object.fromEntries(
    Object.keys(vertexComponentInputsSpec.artifacts ?? {}).map((inputName) => [
      inputName,
      buildVertexArtifactArgumentSpec(
        taskArguments[inputName],
        assertDefined(inputMap.get(inputName)),
        inputsThatHaveParameterArguments.has(inputName),
        addMakeArtifactTaskAndGetArtifactArgumentSpec
      ),
    ])
  );

  const vertexTaskSpec: vertex.PipelineTaskSpec = {
    taskInfo: {
      // This is the task display name, not an ID
      name: componentSpec.name ?? "Component",
    },
    inputs: {
      parameters: vertexTaskParameterArguments,
      artifacts: vertexTaskArtifactArguments,
    },
    // dependent_tasks: [],
    cachingOptions: {
      enableCache: true,
    },
    componentRef: {
      name: vertexComponentId,
    },
    // triggerPolicy: {
    //     condition: "...",
    //     strategy: "ALL_UPSTREAM_TASKS_SUCCEEDED",
    // },
    // iterator: {
    //     artifactIterator: {...},
    //     parameterIterator: {...},
    // },
  };

  return vertexTaskSpec;
};

const makeNameUniqueByAddingIndex = (
  name: string,
  existingNames: Set<string>
): string => {
  let finalName = name;
  let index = 1;
  while (existingNames.has(finalName)) {
    index++;
    finalName = name + " " + index.toString();
  }
  return finalName;
};

export const graphComponentSpecToVertexPipelineSpec = (
  componentSpec: ComponentSpec,
  pipelineContextName = "pipeline"
) => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    throw Error("Only graph components are supported for now");
  }

  // TODO: Fix case when these inputs are passed to tasks as artifacts
  const vertexComponentInputsSpec = {
    parameters: Object.fromEntries(
      (componentSpec.inputs ?? []).map((inputSpec) => [
        inputSpec.name,
        typeSpecToVertexParameterSpec(inputSpec.type),
      ])
    ),
    // Pipeline does not support artifact inputs
    // artifacts: {},
  };

  const graphSpec = componentSpec.implementation.graph;

  let vertexExecutors: Record<string, vertex.ExecutorSpec> = {};
  const executorStringToExecutorId = new Map<string, string>();
  let vertexComponents: Record<string, vertex.ComponentSpec> = {};
  const componentStringToComponentId = new Map<string, string>();
  let vertexTasks: Record<string, vertex.PipelineTaskSpec> = {};
  const taskStringToTaskId = new Map<string, string>();

  const addExecutorAndGetId = (
    executor: vertex.ExecutorSpec,
    namePrefix: string = "Executor"
  ) => {
    const serializedSpec = JSON.stringify(executor);
    const existingId = executorStringToExecutorId.get(serializedSpec);
    if (existingId !== undefined) {
      return existingId;
    }
    const usedIds = new Set(Object.keys(vertexExecutors));
    const id = makeNameUniqueByAddingIndex(namePrefix, usedIds);
    executorStringToExecutorId.set(serializedSpec, id);
    vertexExecutors[id] = executor;
    return id;
  };

  const addComponentAndGetId = (
    component: vertex.ComponentSpec,
    namePrefix: string = "Component"
  ) => {
    const serializedSpec = JSON.stringify(component);
    const existingId = componentStringToComponentId.get(serializedSpec);
    if (existingId !== undefined) {
      return existingId;
    }
    const usedIds = new Set(Object.keys(vertexComponents));
    const id = makeNameUniqueByAddingIndex(namePrefix, usedIds);
    componentStringToComponentId.set(serializedSpec, id);
    vertexComponents[id] = component;
    return id;
  };

  const addTaskAndGetId = (
    task: vertex.PipelineTaskSpec,
    namePrefix: string = "Task"
  ) => {
    const serializedSpec = JSON.stringify(task);
    const existingId = taskStringToTaskId.get(serializedSpec);
    if (existingId !== undefined) {
      return existingId;
    }
    const usedIds = new Set(Object.keys(vertexTasks));
    const id = makeNameUniqueByAddingIndex(namePrefix, usedIds);
    taskStringToTaskId.set(serializedSpec, id);
    vertexTasks[id] = task;
    return id;
  };

  const addMakeArtifactTaskAndGetArtifactArgumentSpec = (
    parameterArgumentSpec: vertex.ParameterArgumentSpec,
    namePrefix: string = "Make artifact"
  ) => {
    // These system names are expected to not conflict with user task names
    vertexExecutors[MAKE_ARTIFACT_EXECUTOR_ID] = makeArtifactExecutorSpec;
    vertexComponents[MAKE_ARTIFACT_COMPONENT_ID] = makeArtifactComponentSpec;

    const makeArtifactTaskSpec = buildMakeArtifactTaskSpec(
      parameterArgumentSpec
    );
    const taskId = addTaskAndGetId(makeArtifactTaskSpec, namePrefix);
    const artifactArgumentSpec: vertex.ArtifactArgumentSpec = {
      taskOutputArtifact: {
        producerTask: taskId,
        outputArtifactKey: MAKE_ARTIFACT_OUTPUT_NAME,
      },
    };
    return artifactArgumentSpec;
  };

  // All root graph inputs are parameters
  const graphInputsWithParameterArguments = new Set(
    (componentSpec.inputs ?? []).map((inputSpec) => inputSpec.name)
  );

  for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
    if (taskSpec.componentRef.spec === undefined) {
      throw Error(`Task "${taskId}" does not have taskSpec.componentRef.spec.`);
    }
    try {
      const vertexTaskSpec =
        taskSpecToVertexTaskSpecComponentSpecAndExecutorSpec(
          taskSpec.componentRef.spec,
          taskSpec.arguments ?? {},
          graphInputsWithParameterArguments,
          addExecutorAndGetId,
          addComponentAndGetId,
          addMakeArtifactTaskAndGetArtifactArgumentSpec
        );
      if (taskId in vertexTasks) {
        throw Error(
          `Task ID "${taskId}" is not unique. This cannot happen (unless user task ID clashes with special task ID).`
        );
      }
      vertexTasks[taskId] = vertexTaskSpec;
    } catch (err) {
      throw Error(`Error compiling task ${taskId}: ` + err.toString());
    }
  }

  const vertexPipelineSpec: vertex.PipelineSpec = {
    pipelineInfo: {
      name: sanitizePipelineInfoName(pipelineContextName),
    },
    sdkVersion: "Cloud-Pipelines",
    schemaVersion: "2.0.0",
    deploymentSpec: {
      executors: vertexExecutors,
    },
    components: vertexComponents,
    root: {
      inputDefinitions: vertexComponentInputsSpec,
      dag: {
        tasks: vertexTasks,
      },
    },
  };
  return vertexPipelineSpec;
};

export const generateVertexPipelineJobFromGraphComponent = (
  componentSpec: ComponentSpec,
  gcsOutputDirectory: string,
  pipelineArguments?: Map<string, string>,
  pipelineContextName = "pipeline"
) => {
  // The pipelineContextName affects caching

  const pipelineSpec = graphComponentSpecToVertexPipelineSpec(
    componentSpec,
    pipelineContextName
  );
  const inputParameterDefinitions =
    (pipelineSpec.root.inputDefinitions ?? {}).parameters ?? {};

  let convertedPipelineArguments: Record<string, any> = {};
  if (pipelineArguments !== undefined) {
    for (const [key, value] of Array.from(pipelineArguments.entries())) {
      convertedPipelineArguments[key] = stringToMlmdValue(
        value,
        inputParameterDefinitions[key].type
      );
    }
  }

  const pipelineJob: vertex.PipelineJob = {
    // name: "<>",
    // Does not show up in the UX
    displayName: componentSpec.name ?? "Pipeline",
    // labels: {},
    runtimeConfig: {
      parameters: convertedPipelineArguments,
      gcsOutputDirectory: gcsOutputDirectory,
    },
    pipelineSpec: pipelineSpec,
    // encryptionSpec: {},
    // serviceAccount: "<>",
    // network: {},
  };
  return pipelineJob;
};
