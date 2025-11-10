import { world, system, EntityQueryOptions } from "@minecraft/server";

// 配置参数
const CONFIG = {
    nearbyEntityThreshold: 5, // 附近实体数量的阈值
    searchRadius: 16, // 搜索附近实体的半径（格）
    perspective1: "ss:far_schema", // 人多时的视角
    perspective2: "ss:near_schema", // 人少时的视角
    excludeSelf: true, // 是否排除玩家自己
    // 添加视角切换冷却时间（游戏刻），避免频繁切换
    switchCooldown: 10
};

// 存储每个玩家的视角状态和最后切换时间
const playerPerspectives = new Map();

function getNearbyEntityCount(player) {
    try {
        const location = player.location;
        const dimension = player.dimension;

        // 创建查询选项
        const queryOptions = new EntityQueryOptions();
        queryOptions.location = location;
        queryOptions.maxDistance = CONFIG.searchRadius;
        queryOptions.excludeTypes = ["minecraft:player"];
        queryOptions.includeTypes = [];

        // 获取附近排除玩家的所有实体
        const nearbyEntities = dimension.getEntities(queryOptions);

        // 筛选出生物（根据实体是否有生命值组件判断）
        const nearbyMobs = nearbyEntities.filter(entity => {
            return entity.hasComponent("minecraft:health");
        });

        return nearbyMobs.length;
    } catch (error) {
        console.warn(`获取玩家 ${player.name} 附近生物数量失败: ${error}`);
        return 0;
    }
}

// 设置玩家相机视角的函数
function setPlayerCamera(player, perspective) {
    try {
        const camera = player.camera;
        if (camera && camera.setCamera) {
            camera.setCamera(perspective);
            return true;
        }
    } catch (error) {
        console.warn(`设置玩家 ${player.name} 相机视角失败: ${error}`);
    }
    return false;
}

// 检查单个玩家的周围环境并切换视角
function checkAndSwitchPlayerPerspective(player) {
    const playerId = player.id;
    const now = system.currentTick;

    // 获取玩家当前状态
    const playerState = playerPerspectives.get(playerId) || {
        perspective: null,
        lastSwitchTick: 0
    };

    // 检查冷却时间，避免频繁切换
    if (now - playerState.lastSwitchTick < CONFIG.switchCooldown) {
        return;
    }

    const nearbyCount = getNearbyEntityCount(player);

    // 确定应该使用的视角
    const targetPerspective = nearbyCount > CONFIG.nearbyEntityThreshold ?
        CONFIG.perspective1 : CONFIG.perspective2;

    // 如果视角没有变化，则不执行操作
    if (playerState.perspective === targetPerspective) {
        return;
    }

    // 更新视角状态和时间
    playerPerspectives.set(playerId, {
        perspective: targetPerspective,
        lastSwitchTick: now
    });

    // 设置新视角
    if (setPlayerCamera(player, targetPerspective)) {
        console.log(`玩家 ${player.name} 视角切换: 附近 ${nearbyCount} 个实体, 使用 ${targetPerspective} 视角`);
    }
}

// 玩家加入时初始化视角
world.afterEvents.playerJoin.subscribe((event) => {
    const players = world.getPlayers({
        name: event.playerName
    });
    const player = players[0];

    if (!player) {
        console.warn(`未找到加入的玩家: ${event.playerName} (ID: ${event.playerId})`);
        return;
    }

    // 延迟一小段时间再检查，确保玩家完全加载
    system.runTimeout(() => {
        checkAndSwitchPlayerPerspective(player);
    }, 10);
});

// 玩家重生时检查视角
world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) {
        const player = event.player;
        system.runTimeout(() => {
            checkAndSwitchPlayerPerspective(player);
        }, 10);
    }
});

// 监听玩家受伤事件
world.afterEvents.entityHurt.subscribe((event) => {
    const entity = event.hurtEntity;
    if (entity.typeId === "minecraft:player") {
        checkAndSwitchPlayerPerspective(entity);
    }
});

// 监听玩家视角转动事件
world.afterEvents.playerRotated.subscribe((event) => {
    checkAndSwitchPlayerPerspective(event.player);
});

// 初始化时设置所有玩家的视角
system.run(() => {
    const initialPlayers = world.getPlayers();

    for (const player of initialPlayers) {
        checkAndSwitchPlayerPerspective(player);
    }

    console.log(`相机视角脚本初始化完成！基于玩家交互和实体数量切换视角`);
});