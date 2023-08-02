import { PrismaClient } from '@prisma/client';
import { createRequirementAnalyst } from './ba-role.seed';
import { createBDDRole } from './bdd-role.seed';
import { createProductManager } from './pm-role.seed';
import { createUIArchitect } from './ui-architect-role.seed';
import { createUIDesigner } from './ui-designer-role.seed';

export enum AppDIYConstants {
  baRoleId = 'biz-requirement-analyst',
  bddRoleId = 'bdd-analyst',
  designerRoleId = 'software-designer',
  uiDesignerRoleId = 'software-ui-designer',
  uiArchitectRoleId = 'software-ui-architect',
  dddRoleId = 'software-domain-designer',
  bffRoleId = 'software-bff-API-designer',
  pmRoleId = 'product-manager',
}

/** 核心是解耦拆解，支点是tree-structured内容产出 */
export const seedAppDIY = (prisma: PrismaClient) => {
  // step1: 需求拆解为user stories
  createRequirementAnalyst(prisma);
  createBDDRole(prisma);
  createUIDesigner(prisma);
  createUIArchitect(prisma);
  // createDDDDesigner(prisma);
  // createBFFDesigner(prisma);
  // 协调多个kbs的transform
  createProductManager(prisma);
};
