import { createObjectCsvWriter } from 'csv-writer';

/**
 * Duplicated from csv-writer as the types are not exported
 */
type ObjectHeaderItem = { id: string; title: string };
type ObjectStringifierHeader = ObjectHeaderItem[] | string[];

export interface ObjectCsvWriterParams {
  path: string;
  header: ObjectStringifierHeader;
  fieldDelimiter?: string;
  recordDelimiter?: string;
  headerIdDelimiter?: string;
  alwaysQuote?: boolean;
  encoding?: string;
  append?: boolean;
}

export type CSVWriterParams<
  TInput extends Record<string, any>,
  TOutput extends Record<string, string>
> = {
  /** The input data to run over */
  data: TInput[];
  /**
   * Converter to turn the output of the chain into what is written into the
   * CSV file. By default, it just combines the input and output data.
   * @param inputData The input data
   * @param outputData The output data from the chains
   * @returns
   */
  outputConverter: (
    inputData: TInput,
    outputData: Record<string, any>
  ) => TOutput;
  /**
   * Any additional parameters to pass into the CSV writer
   */
  csvParams: Partial<ObjectCsvWriterParams>;
  names: string[];
};

/**
 * Creates the CSV Writer to use for the runner based on the provided input
 * parameters.
 * @returns
 */
export function getCSVWriter<
  TInput extends Record<string, any>,
  TOutput extends Record<string, any>
>({
  csvParams,
  data,
  names,
  outputConverter,
}: CSVWriterParams<TInput, TOutput>) {
  const fakeOutput: Record<string, any> = {};
  names.forEach((name) => (fakeOutput[name] = ''));

  return createObjectCsvWriter({
    path: 'output.csv', // Default output file name, if not specified
    ...csvParams,
    header: csvParams.header?.length
      ? csvParams.header
      : Object.keys(outputConverter(data[0], fakeOutput)).map((val) => ({
          id: val,
          title: val.toUpperCase(),
        })),
  });
}
