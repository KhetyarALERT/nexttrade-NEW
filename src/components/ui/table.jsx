import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * @typedef {import("react").ElementRef<"table">} TableRef
 * @typedef {import("react").ComponentPropsWithoutRef<"table">} TableProps
 */

/** @type {import("react").ForwardRefRenderFunction<TableRef, TableProps>} */
function TableInner({ className, ...props }, ref) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

const Table = React.forwardRef(TableInner)
Table.displayName = "Table"

/**
 * @typedef {import("react").ElementRef<"thead">} TableHeaderRef
 * @typedef {import("react").ComponentPropsWithoutRef<"thead">} TableHeaderProps
 */

/** @type {import("react").ForwardRefRenderFunction<TableHeaderRef, TableHeaderProps>} */
function TableHeaderInner({ className, ...props }, ref) {
  return <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
}

const TableHeader = React.forwardRef(TableHeaderInner)
TableHeader.displayName = "TableHeader"

/**
 * @typedef {import("react").ElementRef<"tbody">} TableBodyRef
 * @typedef {import("react").ComponentPropsWithoutRef<"tbody">} TableBodyProps
 */

/** @type {import("react").ForwardRefRenderFunction<TableBodyRef, TableBodyProps>} */
function TableBodyInner({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

const TableBody = React.forwardRef(TableBodyInner)
TableBody.displayName = "TableBody"

/**
 * @typedef {import("react").ElementRef<"tfoot">} TableFooterRef
 * @typedef {import("react").ComponentPropsWithoutRef<"tfoot">} TableFooterProps
 */

/** @type {import("react").ForwardRefRenderFunction<TableFooterRef, TableFooterProps>} */
function TableFooterInner({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

const TableFooter = React.forwardRef(TableFooterInner)
TableFooter.displayName = "TableFooter"

/**
 * @typedef {import("react").ElementRef<"tr">} TableRowRef
 * @typedef {import("react").ComponentPropsWithoutRef<"tr">} TableRowProps
 */

/** @type {import("react").ForwardRefRenderFunction<TableRowRef, TableRowProps>} */
function TableRowInner({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

const TableRow = React.forwardRef(TableRowInner)
TableRow.displayName = "TableRow"

/**
 * @typedef {import("react").ElementRef<"th">} TableHeadRef
 * @typedef {import("react").ComponentPropsWithoutRef<"th">} TableHeadProps
 */

/** @type {import("react").ForwardRefRenderFunction<TableHeadRef, TableHeadProps>} */
function TableHeadInner({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

const TableHead = React.forwardRef(TableHeadInner)
TableHead.displayName = "TableHead"

/**
 * @typedef {import("react").ElementRef<"td">} TableCellRef
 * @typedef {import("react").ComponentPropsWithoutRef<"td">} TableCellProps
 */

/** @type {import("react").ForwardRefRenderFunction<TableCellRef, TableCellProps>} */
function TableCellInner({ className, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

const TableCell = React.forwardRef(TableCellInner)
TableCell.displayName = "TableCell"

/**
 * @typedef {import("react").ElementRef<"caption">} TableCaptionRef
 * @typedef {import("react").ComponentPropsWithoutRef<"caption">} TableCaptionProps
 */

/** @type {import("react").ForwardRefRenderFunction<TableCaptionRef, TableCaptionProps>} */
function TableCaptionInner({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

const TableCaption = React.forwardRef(TableCaptionInner)
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
