import { PrismaClient } from '@prisma/client';
import { createRequirementAnalyst } from './ba-role.seed';
import { createProductManager } from './pm-role.seed';
import { createDesigner } from './designer-role.seed';
import { createBDDRole } from './bdd-role.seed';

export enum AppDIYConstants {
  baRoleId = 'biz-requirement-analyst',
  bddRoleId = 'bdd-analyst',
  designerRoleId = 'software-designer',
  pmRoleId = 'product-manager',
}

/** 核心是解耦拆解，支点是tree-structured内容产出 */
export const seedAppDIY = (prisma: PrismaClient) => {
  // step1: 需求拆解为user stories
  createRequirementAnalyst(prisma);
  createBDDRole(prisma);
  createDesigner(prisma);
  // 协调多个kbs的transform
  createProductManager(prisma);
};
