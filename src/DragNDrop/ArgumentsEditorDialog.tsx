/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import type { ArgumentType, ComponentSpec, TaskSpec } from "../componentSpec";
import ArgumentsEditor from "./ArgumentsEditor";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DndContext, useDraggable, type DragEndEvent } from '@dnd-kit/core';

interface ArgumentsEditorDialogProps {
  taskSpec: TaskSpec;
  closeEditor?: () => void;
  setArguments?: (args: Record<string, ArgumentType>) => void;
  position?: { x: number, y: number };
}

const ArgumentsEditorDialog = ({
  taskSpec,
  closeEditor,
  setArguments,
  position = { x: 100, y: 100 },
}: ArgumentsEditorDialogProps) => {
  const [currentArguments, setCurrentArguments] = useState<
    Record<string, ArgumentType>
  >({ ...taskSpec.arguments });

  const [dialogPosition, setDialogPosition] = useState(position);

  const componentSpec = taskSpec.componentRef.spec;
  if (componentSpec === undefined) {
    console.error(
      "ArgumentsEditor called with missing taskSpec.componentRef.spec",
      taskSpec,
    );
    return <></>;
  }

  const handleApply = () => {
    setArguments?.(currentArguments);
    closeEditor?.();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { delta } = event;
    setDialogPosition({
      x: dialogPosition.x + delta.x,
      y: dialogPosition.y + delta.y,
    });
  };
  const dialogContent = (
    <DndContext onDragEnd={handleDragEnd}>
      <DraggableDialogContent
        dialogPosition={dialogPosition}
        componentSpec={componentSpec}
        currentArguments={currentArguments}
        setCurrentArguments={setCurrentArguments}
        closeEditor={closeEditor ?? (() => {})}
        handleApply={handleApply}
      />
    </DndContext>
  );

  return createPortal(dialogContent, document.body);
};


const DraggableDialogContent = ({
  dialogPosition,
  componentSpec,
  currentArguments,
  setCurrentArguments,
  closeEditor,
  handleApply,
}: {
  dialogPosition: { x: number, y: number };
  componentSpec: ComponentSpec;
  currentArguments: Record<string, ArgumentType>;
  setCurrentArguments: (args: Record<string, ArgumentType>) => void;
  closeEditor: () => void;
  handleApply: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'arguments-dialog',
  });

  const translateX = dialogPosition.x + (transform?.x || 0);
  const translateY = dialogPosition.y + (transform?.y || 0);

  return (
    <div
      ref={setNodeRef}
      className="fixed top-0 left-0 z-[1000]"
      style={{
        transform: `translate(${translateX}px, ${translateY}px)`
      }}
    >
      <Card>
        <CardHeader
          {...attributes}
          {...listeners}
          className="cursor-grab"
        >
          <CardTitle>Input arguments for {componentSpec.name}</CardTitle>
          <CardDescription>Configure the component's input parameters.</CardDescription>
        </CardHeader>
        <CardContent>
          <ArgumentsEditor
            inputs={componentSpec.inputs ?? []}
            componentArguments={currentArguments}
            setComponentArguments={setCurrentArguments}
          />
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={closeEditor}>Close</Button>
          <Button onClick={handleApply}>Apply</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ArgumentsEditorDialog;
