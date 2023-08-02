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
  // #1: 需求生成PRD，拆解为user stories
  createRequirementAnalyst(prisma);
  // #2: UI design, from PRD
  createUIDesigner(prisma);
  // #3 UI framework, from PRD and UI
  createUIArchitect(prisma);
  // #4 DDD services, from PRD (and UI)
  // createDDDDesigner(prisma);
  // #5 BFF APIs, from PRD, UI, DDD
  // createBFFDesigner(prisma);
  // #6 BDD, from PRD, UI, DDD, API, 流程图/时序图, 类图/ER图
  createBDDRole(prisma);
  // 协调多个kbs的transform
  createProductManager(prisma);
};
