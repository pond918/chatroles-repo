import { PrismaClient } from '@prisma/client';
import { createRequirementAnalyst } from './ba-role.seed';
import { createBDDRole } from './bdd-role.seed';
import { createProductManager } from './pm-role.seed';
import { createUIDesigner } from './ui-designer-role.seed';

export enum AppDIYConstants {
  baRoleId = 'biz-requirement-analyst',
  bddRoleId = 'bdd-analyst',
  designerRoleId = 'software-designer',
  uiDesignerRoleId = 'software-ui-designer',
  pmRoleId = 'product-manager',
}

/** 核心是解耦拆解，支点是tree-structured内容产出 */
export const seedAppDIY = (prisma: PrismaClient) => {
  // step1: 需求拆解为user stories
  createRequirementAnalyst(prisma);
  createBDDRole(prisma);
  createUIDesigner(prisma);
  // 协调多个kbs的transform
  createProductManager(prisma);
};
