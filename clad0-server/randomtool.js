#!/usr/bin/env node
'use strict';

/**
 * weighted-random-entry.js
 *
 * Standalone Node tool for selecting a random clado entry with weighted odds.
 *
 * Run from clad0-server:
 *   node weighted-random-entry.js
 *
 * Or point it at a specific file:
 *   node weighted-random-entry.js ./data/clado.json
 *
 * Print top weighted entries:
 *   node weighted-random-entry.js ./data/clado.json --top 25
 *
 * Print every eligible entry as JSON:
 *   node weighted-random-entry.js ./data/clado.json --all
 *
 * Include Catalogue / Reference containers:
 *   node weighted-random-entry.js ./data/clado.json --include-containers
 */

const fs = require('fs');
const path = require('path');

const mathf = {
  random: Math.random,
};

/**
 * Highest rank is index 0.
 * Species is the lowest normal taxonomic rank.
 *
 * rankTierWeight:
 *   Species => 1
 *   Genus   => 2
 *   Family  => 3
 *   ...
 *   Domain  => 8
 *
 * inverseRank:
 *   Domain  => 1
 *   Kingdom => 2
 *   ...
 *   Genus   => 7
 *   Species => 8
 */
const RANK_ORDER = [
  'Domain',
  'Kingdom',
  'Phylum',
  'Class',
  'Order',
  'Family',
  'Genus',
  'Species',
];

/**
 * Extra nonstandard ranks in your data.
 * These are placed before Species but after Genus by default.
 * Adjust these positions if you want different behavior.
 */
const EXTRA_RANK_POSITIONS = {
  Pantheon: 1,
  'Major Deity': 2,
  'Minor Deity': 3,
  Demigod: 4,
  Archdevil: 5,
};

const SPECIES_INDEX = RANK_ORDER.indexOf('Species');

const DEFAULT_DATA_FILE = path.join(process.cwd(), 'data', 'clado.json');

const args = process.argv.slice(2);
const dataFileArg = args.find(a => !a.startsWith('--'));
const DATA_FILE = path.resolve(dataFileArg || DEFAULT_DATA_FILE);

const INCLUDE_CONTAINERS = args.includes('--include-containers');
const PRINT_ALL = args.includes('--all');

const topArgIndex = args.indexOf('--top');
const TOP_N = topArgIndex >= 0 ? Number(args[topArgIndex + 1] || 20) : 0;

function usageAndExit(message) {
  if (message) console.error(`ERROR: ${message}`);
  console.error(`
Usage:
  node weighted-random-entry.js [data-file] [options]

Options:
  --top N                 Print top N weighted entries instead of drawing one
  --all                   Print all eligible entries as JSON
  --include-containers    Include Catalogue and Reference entries
`);
  process.exit(message ? 1 : 0);
}

function readJson(file) {
  if (!fs.existsSync(file)) usageAndExit(`Could not find ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function byteSizeKbOfNode(node) {
  return Buffer.byteLength(JSON.stringify(node), 'utf8') / 1024;
}

function normalizedRank(node, depth) {
  const raw = String(node.r || '').trim();

  if (raw) return raw;

  /**
   * Primordial Existence currently has no explicit rank in the data,
   * but your weighting model treats it as the highest rank.
   */
  if (
    node.id === 'root' ||
    String(node.n || '').trim().toLowerCase() === 'primordial existence'
  ) {
    return RANK_ORDER[0];
  }

  /**
   * If a biological entry lacks a rank, infer roughly from depth.
   * Catalogue wrappers are filtered out by default anyway.
   */
  if (depth >= 0 && depth < RANK_ORDER.length) {
    return RANK_ORDER[Math.min(depth, RANK_ORDER.length - 1)];
  }

  return 'Species';
}

function rankIndexFor(rank) {
  const standardIndex = RANK_ORDER.indexOf(rank);
  if (standardIndex >= 0) return standardIndex;

  if (Object.prototype.hasOwnProperty.call(EXTRA_RANK_POSITIONS, rank)) {
    return EXTRA_RANK_POSITIONS[rank];
  }

  return SPECIES_INDEX;
}

function rankTierWeight(rankIndex) {
  return 1 + Math.max(0, (SPECIES_INDEX - rankIndex)*3);
}

function inverseRank(rankIndex) {
  return rankIndex + 1;
}

function countDescendants(node) {
  let total = 0;

  for (const child of node.c || []) {
    total += 1;
    total += countDescendants(child);
  }

  return total;
}

function countAllNodes(node) {
  return 1 + (node.c || []).reduce((sum, child) => sum + countAllNodes(child), 0);
}

function isContainerLike(node) {
  const tag = String(node.tag || '').trim();
  return tag === 'Catalogue' || tag === 'Reference' || node.treeHidden === true;
}

function isEligible(node) {
  if (!INCLUDE_CONTAINERS && isContainerLike(node)) return false;
  if (node.treeHidden === true) return false;
  return true;
}

function sizeWeightFromKb(sizeKb) {
  /**
   * This implements the formula exactly as written:
   *
   *   abs(45 - max(45, bytesize_in_KB))
   *
   * Result:
   *   <= 45 KB => 0
   *   >  45 KB => sizeKb - 45
   *
   * If you actually want smaller/stubbier entries to gain more weight,
   * replace this with:
   *
   *   return Math.abs(45 - Math.min(45, sizeKb));
   */
  return Math.abs(45 - Math.min(45, sizeKb));
}

function childScarcityMultiplier(descendantCount, totalNodes) {
  /**
   * Your examples imply this curve:
   *
   *   Primordial Existence:
   *     948 descendants / 949 total nodes
   *     ceil((1 - 948/949) * 10) = 1
   *
   *   Genus with 2 descendants:
   *     2 descendants / 949 total nodes
   *     ceil((1 - 2/949) * 10) = 10
   */
  if (totalNodes <= 0) return 7.5;

  const coverage = descendantCount / totalNodes;
  const scarcity = Math.ceil((1 - coverage) * 7.5);

  return Math.max(1, Math.min(7.5, scarcity));
}

function calculateWeight(node, totalNodes, depth) {
  const rank = normalizedRank(node, depth);
  const rankIndex = rankIndexFor(rank);

  const baseWeight = rankTierWeight(rankIndex);

  const descendants = countDescendants(node);
  const isSpecies = rank === 'Species' || rankIndex >= SPECIES_INDEX;

  let childMultiplier = 0;
  let childWeight = 0;

  if (!isSpecies) {
    childMultiplier = childScarcityMultiplier(descendants, totalNodes);
    childWeight = childMultiplier * inverseRank(rankIndex);
  }

  const sizeKb = byteSizeKbOfNode(node);
  const sizeWeight = sizeWeightFromKb(sizeKb);

  const totalWeight = baseWeight + childWeight + sizeWeight;

  return {
    totalWeight,
    baseWeight,
    childWeight,
    sizeWeight,
    rank,
    rankIndex,
    inverseRank: inverseRank(rankIndex),
    descendants,
    childMultiplier,
    sizeKb,
  };
}

function flatten(root) {
  const totalNodes = countAllNodes(root);
  const entries = [];

  function walk(node, depth, parentPath) {
    const name = String(node.n || '(unnamed)');
    const currentPath = parentPath ? `${parentPath} > ${name}` : name;

    if (isEligible(node)) {
      const weight = calculateWeight(node, totalNodes, depth);

      entries.push({
        id: node.id || '',
        name,
        rank: weight.rank,
        path: currentPath,
        totalWeight: weight.totalWeight,
        baseWeight: weight.baseWeight,
        childWeight: weight.childWeight,
        sizeWeight: weight.sizeWeight,
        inverseRank: weight.inverseRank,
        childMultiplier: weight.childMultiplier,
        descendants: weight.descendants,
        sizeKb: Number(weight.sizeKb.toFixed(3)),
        node,
      });
    }

    for (const child of node.c || []) {
      walk(child, depth + 1, currentPath);
    }
  }

  walk(root, 0, '');

  return {
    totalNodes,
    entries,
  };
}

function weightedRandom(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.totalWeight, 0);

  if (total <= 0) {
    throw new Error('Total weight is zero; no selectable entries.');
  }

  let roll = mathf.random() * total;

  for (const entry of entries) {
    roll -= entry.totalWeight;
    if (roll <= 0) return entry;
  }

  return entries[entries.length - 1];
}

function publicEntry(entry) {
  return {
    id: entry.id,
    name: entry.name,
    rank: entry.rank,
    path: entry.path,
    totalWeight: Number(entry.totalWeight.toFixed(3)),
    baseWeight: Number(entry.baseWeight.toFixed(3)),
    childWeight: Number(entry.childWeight.toFixed(3)),
    sizeWeight: Number(entry.sizeWeight.toFixed(3)),
    inverseRank: entry.inverseRank,
    childMultiplier: entry.childMultiplier,
    descendants: entry.descendants,
    sizeKb: entry.sizeKb,
  };
}

function main() {
  if (args.includes('--help') || args.includes('-h')) {
    usageAndExit();
  }

  const root = readJson(DATA_FILE);
  const { totalNodes, entries } = flatten(root);

  if (!entries.length) {
    throw new Error('No eligible entries found.');
  }

  entries.sort((a, b) => b.totalWeight - a.totalWeight);

  if (PRINT_ALL) {
    console.log(JSON.stringify({
      dataFile: DATA_FILE,
      totalNodes,
      eligibleEntries: entries.length,
      entries: entries.map(publicEntry),
    }, null, 2));
    return;
  }

  if (TOP_N > 0) {
    console.log(JSON.stringify({
      dataFile: DATA_FILE,
      totalNodes,
      eligibleEntries: entries.length,
      top: entries.slice(0, TOP_N).map(publicEntry),
    }, null, 2));
    return;
  }

  const selected = weightedRandom(entries);

  console.log(JSON.stringify({
    dataFile: DATA_FILE,
    totalNodes,
    eligibleEntries: entries.length,
    selected: publicEntry(selected),
  }, null, 2));
}

try {
  main();
} catch (err) {
  console.error('ERROR:', err && err.message ? err.message : err);
  process.exit(1);
}