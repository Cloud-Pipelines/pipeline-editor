/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import type {
  ArgumentType,
  InputSpec,
  TypeSpecType,
} from "../componentSpec";
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"


interface ArgumentsEditorProps {
  inputs: InputSpec[];
  componentArguments: Record<string, ArgumentType>;
  setComponentArguments: (args: Record<string, ArgumentType>) => void;
  shrinkToWidth?: boolean;
}

const typeSpecToString = (typeSpec?: TypeSpecType): string => {
  if (typeSpec === undefined) {
    return "Any";
  }
  if (typeof typeSpec === "string") {
    return typeSpec;
  }
  return JSON.stringify(typeSpec);
};

const getInputValueOrPlaceholder = (argument: ArgumentType, inputSpec: InputSpec) => {

  if (argument === undefined) {
    return {
      value: inputSpec.default,
      placeholder: undefined
    };
  }

  if (typeof argument === "string") {
    return {
      value: argument,
      placeholder: undefined
    };
  }
  if ("taskOutput" in argument) {
    return {
      value: undefined,
      placeholder: `<from task ${argument.taskOutput.taskId} / ${argument.taskOutput.outputName}>`
    };
  }
  if ("graphInput" in argument) {
    return {
      value: undefined,
      placeholder: `<from graph input ${argument.graphInput.inputName}>`
    };
  }
  return {
    value: undefined,
    placeholder: "<reference>"
  };
}

const ArgumentsEditor = ({
  inputs,
  componentArguments,
  setComponentArguments,
}: ArgumentsEditorProps) => {

  const handleSetDefaultOrRemove = (input: InputSpec) => {
    const newArgs = { ...componentArguments };
    if (input.default !== undefined) {
      newArgs[input.name] = input.default;
    } else {
      delete newArgs[input.name];
    }
    setComponentArguments(newArgs);
  }
  return <ScrollArea className="h-[500px] p-4">
    {inputs.map((input) => {
      return <div key={input.name} className="flex flex-col gap-2 mb-4">
        <Label htmlFor={input.name}>{input.name} ({typeSpecToString(input.type) + (!input.optional ? "*" : "")})</Label>
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            id={input.name}
            {...getInputValueOrPlaceholder(componentArguments[input.name], input)}
            onChange={(e) => {
              setComponentArguments({ ...componentArguments, [input.name]: e.target.value });
            }}

            required={!input.optional}
          />
          <Button type="button" onClick={() => {
            handleSetDefaultOrRemove(input);
          }}>⌧</Button>
        </div>
      </div>
    })}
  </ScrollArea>

};

export default ArgumentsEditor;
