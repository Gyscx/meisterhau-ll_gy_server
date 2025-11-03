import { TargetLock } from "@combat/basic/components/core/target-lock"
import { InputSimulator } from "../inputSimulator"
import { Optional } from "@utils/optional"
import { Status } from "../status"
import { actorSelector } from "@combat/basic"
import { Actor, ActorHelper } from "@utils/actor"
import { yawToVec2 } from "@utils/math"

/**
 * AI动作类 - 扩展输入模拟器，提供AI特定的动作功能
 * 包括目标设置、视线追踪、事件触发等
 */
export class AiActions extends InputSimulator {

    /**
     * 设置AI的目标
     * @param target 目标角色
     */
    setTarget(target: Actor) {
        this.actor.use(actor => {
            const targetLock = new TargetLock(this.actor, Optional.some(target))
            const components = Status.get(actor.uniqueId)?.componentManager
            components?.attachComponent(targetLock)
        })
    }

    /**
     * 移除AI的目标
     */
    removeTarget() {
        this.actor.use(actor => Status.get(actor.uniqueId)?.componentManager?.detachComponent(TargetLock))
    }

    /**
     * 看向最近的实体
     * @param radius 搜索半径，默认为10
     * @param family 实体类型数组，默认为['mob']
     */
    lookAtNearest(radius = 10, family: string[] = [ 'mob' ]) {
        this.actor.use(actor => {
            const selector = actorSelector(actor)
            const typeFamiliy = family.map(t => `family=${t}`).join(",")
            mc.runcmdEx(`execute at ${selector} as ${selector} run tp @s ~~~ facing @e[c=1,r=${radius}${typeFamiliy ? `,${typeFamiliy}` : ''}]`)
        })
    }

    /**
     * 将前方实体设置为目标
     * @param length 视线距离，默认为8
     * @returns 是否成功设置目标
     */
    setForwardActorAsTarget(length = 8) {
        if (this.actor.isEmpty()) {
            return false
        }

        const actor = this.actor.unwrap()
        const pos = ActorHelper.pos(actor)
        if (pos.isEmpty()) {
            return
        }

        const pos_ = pos.unwrap()
        const entities: Actor[] = mc.getEntities(pos_, length).filter(en => en.uniqueId !== actor.uniqueId).concat(mc.getOnlinePlayers() as any[])
        const entity = entities.find(en => {
            const pos = ActorHelper.pos(en)
            return pos.match(
                false,
                pos => {
                    if (pos.dimid !== pos_.dimid) {
                        return false
                    }

                    if (ActorHelper.isPlayer(en)) {
                        if (en.distanceTo(actor) > length) {
                            return false
                        }
                    }

                    const dist = {
                        x: pos_.x - pos.x,
                        y: pos_.z - pos.z,
                    }
                    const dir = yawToVec2(en.direction.yaw)

                    return dist.x * dir.x + dist.y * dir.y > 0
                }
            )
        })

        if (!entity) {
            return false
        }

        this.setTarget(entity)

        return true
    }

    /**
     * 触发预定义的事件
     * @param event 事件名称
     */
    triggerDefinedEvent(event: string) {
        this.actor.use(actor => mc.runcmdEx(`event entity ${actorSelector(actor)} ${event}`))
    }

}
