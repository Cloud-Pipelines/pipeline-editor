import {
    ArgumentType,
    ComponentSpec,
    StringOrPlaceholder,
    TypeSpecType,
    isContainerImplementation,
    isGraphImplementation
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
    return pipelineContextName.toLowerCase().replace(/\W/, '-')
}

type ResolvedCommandLineAndArgs = {
    command?: string[],
    args?: string[],
    inputsConsumedAsValue: Set<string>,
    inputsConsumedAsPath: Set<string>,
};

const resolveCommandLine = (componentSpec: ComponentSpec, taskArguments: Record<string, ArgumentType>): ResolvedCommandLineAndArgs => {
    if (!isContainerImplementation(componentSpec.implementation)) {
      throw Error("resolveCommandLine only supports container components");
    }
    const containerSpec = componentSpec.implementation.container;

    const inputsConsumedAsValue = new Set<string>();
    const inputsConsumedAsPath = new Set<string>();
    const convertArg = (arg: StringOrPlaceholder): string[] => {
        if (typeof arg == "string") {
            return [arg];
        } else if ('inputValue' in arg) {
            const inputName = arg.inputValue;
            const argument = taskArguments[inputName];
            if (argument !== undefined && typeof argument != "string" && "taskOutput" in argument) {
                // ! Important details:
                // In this branch, the argument comes from task output.
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
        } else if ('inputPath' in arg) {
            const inputName = arg.inputPath;
            inputsConsumedAsPath.add(inputName);
            return [`{{$.inputs.artifacts['${inputName}'].path}}`];
        } else if ('outputPath' in arg) {
            const outputName = arg.outputPath;
            return [`{{$.outputs.artifacts['${outputName}'].path}}`];
        } else if ('if' in arg) {
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
              if (! (inputName in taskArguments)) {
                condEvaluatesToTrue = false;
              } else {
                const taskArgument = taskArguments[inputName];
                if (typeof taskArgument === "string") {
                    condEvaluatesToTrue = taskArgument.toLowerCase() === "true";
                } else {
                    throw Error("Using runtime conditions in component command line placeholders is not supported yet.")
                }
              }
            } else {
                throw Error("Unexpected contition kind: " + ifCond);
            }
            const unresolvedArgs = condEvaluatesToTrue ? ifThen : ifElse;
            if (unresolvedArgs === undefined) {
                return [];
            }
            return unresolvedArgs.flatMap(convertArg);
        } else if ('concat' in arg) {
            const concatArgs = arg.concat;
            return concatArgs.flatMap(convertArg);
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
}

const typeSpecToVertexPrimitiveTypeEnum = (typeSpec: TypeSpecType | undefined): vertex.PrimitiveTypeEnum => {
    if (typeof typeSpec === "string") {
        if (["integer"].includes(typeSpec.toLowerCase())) {
            return vertex.PrimitiveTypeEnum.INT;
        }
        if (["float", "double"].includes(typeSpec.toLowerCase())) {
            return vertex.PrimitiveTypeEnum.DOUBLE;
        }
    }
    return vertex.PrimitiveTypeEnum.STRING;
}

const typeSpecToVertexParameterSpec = (typeSpec: TypeSpecType | undefined): vertex.InputParameterSpec => {
    return {
        type: typeSpecToVertexPrimitiveTypeEnum(typeSpec)
    }
}

const typeSpecToVertexArtifactTypeSchema = (typeSpec: TypeSpecType | undefined): vertex.ArtifactTypeSchema => {
    // TODO: Implement better mapping
    const artifactTypeSchema = {
        schemaTitle: "system.Artifact"
    }
    return artifactTypeSchema
}

const typeSpecToVertexArtifactSpec = (typeSpec: TypeSpecType | undefined): vertex.InputArtifactSpec => {
    return {
        artifactType: typeSpecToVertexArtifactTypeSchema(typeSpec)
    }
}
// const typeSpecToVertexArtifactType(typeSpec: TypeSpecType) => {
//     return typeof typeSpec === "string" && ["String", "Integer", "Float", "Double", "Boolean", ]
// }

const MAKE_ARTIFACT_COMPONENT_ID = "_make_artifact";
const MAKE_ARTIFACT_EXECUTOR_ID = "_make_artifact";
const MAKE_ARTIFACT_INPUT_NAME = "parameter";
const MAKE_ARTIFACT_OUTPUT_NAME = "artifact";

const makeArtifactTaskSpecTemplate: vertex.PipelineTaskSpec = {
    componentRef: {
        name: MAKE_ARTIFACT_COMPONENT_ID
    },
    taskInfo: {
        name: "Make artifact"
    },
    inputs: {
        parameters: {}
    },
    cachingOptions: {
        enableCache: true
    }
};

const makeArtifactComponentSpec: vertex.ComponentSpec = {
    executorLabel: MAKE_ARTIFACT_EXECUTOR_ID,
    inputDefinitions: {
        parameters: {
            [MAKE_ARTIFACT_INPUT_NAME]: {
                type: vertex.PrimitiveTypeEnum.STRING
            }
        }
    },
    outputDefinitions: {
        artifacts: {
            [MAKE_ARTIFACT_OUTPUT_NAME]: {
                artifactType: {
                    schemaTitle: "system.Artifact"
                }
            }
        }
    }
};

const makeArtifactExecutorSpec: vertex.ExecutorSpec = {
    container: {
        image: "alpine",
        command: [
            "sh", "-ec", 'mkdir -p "$(dirname "$1")"; printf "%s" "$0" > "$1"',
            `{{$.inputs.parameters['${MAKE_ARTIFACT_INPUT_NAME}']}}`,
            `{{$.outputs.artifacts['${MAKE_ARTIFACT_OUTPUT_NAME}'].path}}`
        ]
    }
}

const taskSpecToVertexTaskSpecComponentSpecAndExecutorSpec = (
    componentSpec: ComponentSpec,
    //passedArgumentNames: string[],
    taskArguments: Record<string, ArgumentType>,
    generateTaskID: (prefix: string) => string,
    isRoot = false,
) => {
    if (!isContainerImplementation(componentSpec.implementation)) {
        // TODO: Support nested graph components
        throw Error("Nested graph components are not supported yet");
    }
    const containerSpec = componentSpec.implementation.container;


    const resolvedCommandLine = resolveCommandLine(componentSpec, taskArguments);

    const vertexExecutorSpec: vertex.ExecutorSpec = {
        container: {
            image: containerSpec.image,
            command: resolvedCommandLine.command,
            args: resolvedCommandLine.args,
        }
    };

    // resolvedCommandLine.inputsConsumedAsPath

    const inputMap = new Map((componentSpec.inputs ?? []).map(inputSpec => [inputSpec.name, inputSpec]));

    // Array.from(inputMap.keys()).filter(resolvedCommandLine.inputsConsumedAsValue.has)

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
            typeSpecToVertexArtifactSpec(inputMap.get(inputName)?.type)
          ]
        )
      ),
    };

    const vertexComponentOutputsSpec: vertex.ComponentOutputsSpec = {
      parameters: {}, // Parameters will be added later as needed
      artifacts: Object.fromEntries(
        (componentSpec.outputs ?? []).map((outputSpec) => [
          outputSpec.name,
          typeSpecToVertexArtifactSpec(outputSpec.type)
        ])
      ),
    };

    const vertexComponentSpec: vertex.ComponentSpec = {
        inputDefinitions: vertexComponentInputsSpec,
        outputDefinitions: vertexComponentOutputsSpec,
        // dag
        executorLabel: "<set later>",
    };

    const vertexTaskParameterArguments: Record<string, vertex.ParameterArgumentSpec> = Object.fromEntries(Array.from(resolvedCommandLine.inputsConsumedAsValue.values()).map(inputName => [inputName, (inputName => {
        // TODO: Check that this works
        let taskArgument = taskArguments[inputName];
        //if (! (inputName in taskArguments)) {
        if (taskArgument === undefined) {
            // Checking for default value
            const inputSpec = inputMap.get(inputName);
            if (inputSpec === undefined) {
                throw Error(`Cannot happen: vertexTaskParameterArguments - inputMap.get(${inputName}) === undefined`)
            }
            if (inputSpec.default !== undefined) {
                taskArgument = inputSpec.default;
            } else {
                if (inputSpec.optional === true) {
                    // TODO: Decide what the behavior should be
                    // throw Error(`Input "${inputName}" is optional, but command-line still uses it when when it's not present.`);
                    console.error(`Input "${inputName}" is optional, but command-line still uses it when when it's not present.`);
                    taskArgument = "";
                } else {
                    throw Error(`Argument was not provided for required input "${inputName}"`);
                }
            }
        }
        let result: vertex.ParameterArgumentSpec;
        if (typeof taskArgument === "string" ) {
            result = {
                runtimeValue: {
                    constantValue: {
                        // TODO: Fix constant arguments for non-string inputs
                        stringValue: taskArgument,
                    }
                }
            };
            return result;
        } else if ('graphInput' in taskArgument) {
            result = {
                componentInputParameter: taskArgument.graphInput.inputName,
            };
            return result;
        } else if ('taskOutput' in taskArgument) {
            result = {
                taskOutputParameter: {
                    producerTask: taskArgument.taskOutput.taskId,
                    outputParameterKey: taskArgument.taskOutput.outputName,
                }
            };
            return result;
        } else {
            throw Error(`Unknown kind of task argument: "${taskArgument}"`);
        }
    })(inputName)]));

    let vertexMakeArtifactTaskSpecs: Record<string, vertex.PipelineTaskSpec> = {};

    const vertexTaskArtifactArguments: Record<string, vertex.ArtifactArgumentSpec> = Object.fromEntries(Array.from(resolvedCommandLine.inputsConsumedAsPath.values()).map(inputName => [inputName, (inputName => {
        // TODO: Check that this works
        let taskArgument = taskArguments[inputName];
        //if (! (inputName in taskArguments)) {
        if (taskArgument === undefined) {
            // Checking for default value
            const inputSpec = inputMap.get(inputName);
            if (inputSpec === undefined) {
                throw Error(`Cannot happen: vertexTaskParameterArguments - inputMap.get(${inputName}) === undefined`)
            }
            if (inputSpec.default !== undefined) {
                taskArgument = inputSpec.default;
            } else {
                if (inputSpec.optional === true) {
                    // TODO: Decide what the behavior should be
                    // throw Error(`Input "${inputName}" is optional, but command-line still uses it when when it's not present.`);
                    console.error(`Input "${inputName}" is optional, but command-line still uses it when when it's not present.`);
                    taskArgument = "";
                } else {
                    throw Error(`Argument was not provided for required input "${inputName}"`);
                }
            }
        }
        let result: vertex.ArtifactArgumentSpec;
        if (typeof taskArgument === "string" ) {
            const makeArtifactTaskId = generateTaskID("Make artifact");
            const makeArtifactTaskSpec: vertex.PipelineTaskSpec = {
                ...makeArtifactTaskSpecTemplate,
                inputs: {
                    parameters: {
                        [MAKE_ARTIFACT_INPUT_NAME]: {
                            runtimeValue: {
                                constantValue: {
                                    stringValue: taskArgument
                                }
                            }
                        }
                    }
                }
            };
            vertexMakeArtifactTaskSpecs[makeArtifactTaskId] = makeArtifactTaskSpec;
            result = {
                taskOutputArtifact: {
                    producerTask: makeArtifactTaskId,
                    outputArtifactKey: MAKE_ARTIFACT_OUTPUT_NAME
                }
            };
            return result;
        } else if ('graphInput' in taskArgument) {
            // Workaround for root DAG where all inputs must be parameters
            if (isRoot) {
                // We only need one task for each pipeline input parameter
                //const makeArtifactTaskId = generateTaskID("Make artifact");
                const makeArtifactTaskId = "Make artifact for " + taskArgument.graphInput.inputName;
                const makeArtifactTaskSpec: vertex.PipelineTaskSpec = {
                    ...makeArtifactTaskSpecTemplate,
                    inputs: {
                        parameters: {
                            [MAKE_ARTIFACT_INPUT_NAME]: {
                                componentInputParameter: taskArgument.graphInput.inputName
                            }
                        }
                    }
                };
                vertexMakeArtifactTaskSpecs[makeArtifactTaskId] = makeArtifactTaskSpec;
                result = {
                    taskOutputArtifact: {
                        producerTask: makeArtifactTaskId,
                        outputArtifactKey: MAKE_ARTIFACT_OUTPUT_NAME
                    }
                };
            } else {
                result = {
                    componentInputArtifact: taskArgument.graphInput.inputName,
                };
            }
            return result;
        } else if ('taskOutput' in taskArgument) {
            result = {
                taskOutputArtifact: {
                    producerTask: taskArgument.taskOutput.taskId,
                    outputArtifactKey: taskArgument.taskOutput.outputName,
                }
            };
            return result;
        } else {
            throw Error(`Unknown kind of task argument: "${taskArgument}"`);
        }
    })(inputName)]));
    
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
          name: "<set later>"
        },
        // triggerPolicy: {
        //     condition: "...",
        //     strategy: "ALL_UPSTREAM_TASKS_SUCCEEDED",
        // },
        // iterator: {
        //     artifactIterator: {...},
        //     parameterIterator: {...},
        // },
    }
    
    return { vertexTaskSpec, vertexComponentSpec, vertexExecutorSpec, vertexMakeArtifactTaskSpecs };
}

const makeNameUniqueByAddingIndex = (name: string, existingNames: Set<string>): string => {
    let finalName = name;
    let index = 1;
    while (existingNames.has(finalName)) {
      index++;
      finalName = name + " " + index.toString();
    }
    return finalName;
  };

const graphComponentSpecToVertexPipelineSpec = (componentSpec: ComponentSpec, pipelineContextName = "pipeline") => {
    if (!isGraphImplementation(componentSpec.implementation)) {
        throw Error("Only graph components are supported for now")
    }

    // TODO: Fix case when these inputs are passed to tasks as artifacts
    const vertexComponentInputsSpec = {
        parameters: Object.fromEntries(
          (componentSpec.inputs ?? []).map(
            (inputSpec) => [inputSpec.name, typeSpecToVertexParameterSpec(inputSpec.type)]
          )
        ),
        // Pipeline does not support artifact inputs
        // artifacts: {},
    };

    const graphSpec = componentSpec.implementation.graph;

    let vertexExecutors: Record<string, vertex.ExecutorSpec> = {};
    let vertexComponents: Record<string, vertex.ComponentSpec> = {};
    let vertexTasks: Record<string, vertex.PipelineTaskSpec> = {};

    let usedTaskIds = new Set<string>(Object.keys(graphSpec.tasks));
    const generateTaskId = (prefix: string) => {
        const taskId = makeNameUniqueByAddingIndex(prefix, usedTaskIds);
        usedTaskIds.add(taskId);
        return taskId;
    };

    for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
        if (taskSpec.componentRef.spec === undefined) {
            throw Error(`Task "${taskId}" does not have taskSpec.componentRef.spec.`)
        }
        try {
            const { vertexTaskSpec, vertexComponentSpec, vertexExecutorSpec, vertexMakeArtifactTaskSpecs } = taskSpecToVertexTaskSpecComponentSpecAndExecutorSpec(taskSpec.componentRef.spec, taskSpec.arguments ?? {}, generateTaskId, true);
            // task IDs are expected to be unique
            // TODO: Fix  this to work for multi-dag pipelines where task IDs are not globally unique
            const vertexExecutorId = taskId + "_executor";
            const vertexComponentId = taskId + "_component";
            const vertexTaskId = taskId; // + "_task";
            usedTaskIds.add(vertexTaskId);
            vertexExecutors[vertexExecutorId] = vertexExecutorSpec;
            vertexComponentSpec.executorLabel = vertexExecutorId;
            vertexComponents[vertexComponentId] = vertexComponentSpec;
            vertexTaskSpec.componentRef.name = vertexComponentId;
            // This is the task display name, not an ID. It's already set to the component name
            //vertexTaskSpec.taskInfo.name = vertexTaskId;
            vertexTasks[vertexTaskId] = vertexTaskSpec;
            // Processing the additional MakeArtifact tasks
            for (const [additionalTaskId, additionalTaskSpec] of Object.entries(vertexMakeArtifactTaskSpecs)) {
                usedTaskIds.add(additionalTaskId);
                vertexExecutors[MAKE_ARTIFACT_EXECUTOR_ID] = makeArtifactExecutorSpec;
                vertexComponents[MAKE_ARTIFACT_COMPONENT_ID] = makeArtifactComponentSpec;
                vertexTasks[additionalTaskId] = additionalTaskSpec;
            }
        } catch(err) {
            throw Error(`Error compiling task ${taskId}: ` + err.toString());
        }
    }

    const vertexPipelineSpec: vertex.PipelineSpec = {
        pipelineInfo: {
            name: sanitizePipelineInfoName(pipelineContextName)
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
          }
        },
    };
    return vertexPipelineSpec;
};

const generateVertexPipelineJobFromGraphComponent = (
  componentSpec: ComponentSpec,
  gcsOutputDirectory: string,
  pipelineArguments?: Map<string, string>,
  pipelineContextName = "pipeline",
) => {
  // The pipelineContextName affects caching

  // TODO: FIX: Do proper conversion of integers
  //let convertedPipelineArguments = new Map<String, object>(Array.from(pipelineArguments.entries()).map((key, value) => [key, value]));
  let convertedPipelineArguments: Record<string, any> = {};
  if (pipelineArguments !== undefined) {
    for (const [key, value] of Array.from(pipelineArguments.entries())) {
      convertedPipelineArguments[key] = {
        stringValue: value,
        //intValue
        //doubleValue
      };
    }
  }

  const pipelineSpec = graphComponentSpecToVertexPipelineSpec(componentSpec, pipelineContextName);

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

export { graphComponentSpecToVertexPipelineSpec, generateVertexPipelineJobFromGraphComponent };
