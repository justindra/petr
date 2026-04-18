#!/usr/bin/env bun
import('@oclif/core').then((oclif) => oclif.execute({ development: true, dir: import.meta.url }));
