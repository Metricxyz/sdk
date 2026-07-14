import fs from "fs";
import path from "path";
import {
  decodeFunctionData,
  encodeAbiParameters,
  getCreate2Address,
  keccak256,
  pad,
  parseAbi,
  type Address,
  type Hex,
} from "viem";

export const CREATEX_ADDRESS = "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed" as const;
export const CREATE2_SALT = "0x000000000000000000000000000000000000000000000000000000000000002a" as const;

export const CANONICAL_ADDRESSES = {
  factory: "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C",
  poolDeployer: "0x0f732971a3503afee276782173170D1F1154d4c1",
  stateView: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8",
} as const satisfies Record<string, Address>;

const CREATEX_DEPLOY_ABI = parseAbi([
  "function deployCreate2(bytes32 salt, bytes initCode) payable returns (address)",
]);

const DEFAULT_JOURNAL_PATH = path.join(
  process.cwd(),
  "ignition/deployments/dep-02a-base/journal.jsonl",
);

type JournalRecord = {
  futureId?: string;
  networkInteraction?: { data?: Hex };
  constructorArgs?: unknown[];
};

function readJournalLines(journalPath: string): JournalRecord[] {
  const content = fs.readFileSync(journalPath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JournalRecord);
}

export function getGuardedCreate2Salt(salt: Hex = CREATE2_SALT): Hex {
  return keccak256(encodeAbiParameters([{ type: "bytes32" }], [salt]));
}

export function predictCreate2Address(initCode: Hex, salt: Hex = CREATE2_SALT): Address {
  return getCreate2Address({
    bytecode: initCode,
    from: CREATEX_ADDRESS,
    opcode: "CREATE2",
    salt: getGuardedCreate2Salt(salt),
  });
}

export function extractInitCodeFromCalldata(calldata: Hex): Hex {
  const { args } = decodeFunctionData({
    abi: CREATEX_DEPLOY_ABI,
    data: calldata,
  });
  return args[1];
}

export function extractInitCodeFromJournal(
  futureId: string,
  journalPath: string = DEFAULT_JOURNAL_PATH,
): Hex {
  for (const record of readJournalLines(journalPath)) {
    if (record.futureId !== futureId || !record.networkInteraction?.data) {
      continue;
    }
    return extractInitCodeFromCalldata(record.networkInteraction.data);
  }
  throw new Error(`Init code not found in journal for ${futureId}`);
}

export function extractConstructorArgsFromJournal(
  futureId: string,
  journalPath: string = DEFAULT_JOURNAL_PATH,
): unknown[] {
  for (const record of readJournalLines(journalPath)) {
    if (record.futureId === futureId && record.constructorArgs) {
      return record.constructorArgs;
    }
  }
  throw new Error(`Constructor args not found in journal for ${futureId}`);
}

export function buildRouterInitCodeForWeth(
  weth: Address,
  journalPath: string = DEFAULT_JOURNAL_PATH,
): Hex {
  const routerFutureId = "FullDeployment#MetricOmmSwapRouter";
  const initCode = extractInitCodeFromJournal(routerFutureId, journalPath);
  const [referenceWeth] = extractConstructorArgsFromJournal(routerFutureId, journalPath) as [Address];
  const encodedReferenceWeth = pad(referenceWeth, { size: 32 }).slice(2);
  const encodedWeth = pad(weth, { size: 32 }).slice(2);

  if (!initCode.toLowerCase().endsWith(encodedReferenceWeth.toLowerCase())) {
    throw new Error(
      `Router init code from ${journalPath} does not end with reference WETH ${referenceWeth}`,
    );
  }

  return `${initCode.slice(0, -64)}${encodedWeth}` as Hex;
}

export interface Dep02aInitCodes {
  journalPath: string;
  weth: Address;
  factory: Hex;
  poolDeployer: Hex;
  router: Hex;
  stateView: Hex;
  predicted: {
    factory: Address;
    poolDeployer: Address;
    router: Address;
    stateView: Address;
  };
}

export function loadDep02aInitCodes(
  weth: Address,
  journalPath: string = DEFAULT_JOURNAL_PATH,
): Dep02aInitCodes {
  const factory = extractInitCodeFromJournal("FullDeployment#MetricOmmPoolFactory", journalPath);
  const poolDeployer = extractInitCodeFromJournal("FullDeployment#MetricOmmPoolDeployer", journalPath);
  const router = buildRouterInitCodeForWeth(weth, journalPath);
  const stateView = extractInitCodeFromJournal("FullDeployment#MetricOmmPoolStateView", journalPath);

  const predicted = {
    factory: predictCreate2Address(factory),
    poolDeployer: predictCreate2Address(poolDeployer),
    router: predictCreate2Address(router),
    stateView: predictCreate2Address(stateView),
  };

  if (predicted.factory !== CANONICAL_ADDRESSES.factory) {
    throw new Error(`Factory address mismatch: expected ${CANONICAL_ADDRESSES.factory}, got ${predicted.factory}`);
  }
  if (predicted.poolDeployer !== CANONICAL_ADDRESSES.poolDeployer) {
    throw new Error(
      `PoolDeployer address mismatch: expected ${CANONICAL_ADDRESSES.poolDeployer}, got ${predicted.poolDeployer}`,
    );
  }
  if (predicted.stateView !== CANONICAL_ADDRESSES.stateView) {
    throw new Error(
      `StateView address mismatch: expected ${CANONICAL_ADDRESSES.stateView}, got ${predicted.stateView}`,
    );
  }

  return {
    journalPath,
    weth,
    factory,
    poolDeployer,
    router,
    stateView,
    predicted,
  };
}
