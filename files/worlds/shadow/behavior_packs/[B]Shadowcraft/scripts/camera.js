import { world, system, EntityQueryOptions } from "@minecraft/server";

// 配置参数
const CONFIG = {
    nearbyEntityThreshold: 5, // 附近实体数量的阈值
    searchRadius: 16, // 搜索附近实体的半径（格）
    perspective1: "ss:far_schema", // 人多时的视角
    perspective2: "ss:near_schema", // 人少时的视角
    checkInterval: 100, // 检查间隔（游戏刻）
    excludeSelf: true // 是否排除玩家自己
};

// 存储每个玩家的视角状态
const playerPerspectives = new Map();

// 获取玩家附近的实体数量
function getNearbyEntityCount(player) {
    try {
        const location = player.location;
        const dimension = player.dimension;

        // 创建查询选项
        const queryOptions = new EntityQueryOptions();
        queryOptions.location = location;
        queryOptions.maxDistance = CONFIG.searchRadius;

        // 获取附近的所有实体
        const nearbyEntities = dimension.getEntities(queryOptions);

        // 计算数量（可选排除玩家自己）
        let count = nearbyEntities.length;
        if (CONFIG.excludeSelf) {
            count = nearbyEntities.filter(entity => entity.id !== player.id).length;
        }

        return count;
    } catch (error) {
        console.warn(`获取玩家 ${player.name} 附近实体数量失败: ${error}`);
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
    const nearbyCount = getNearbyEntityCount(player);
    const playerId = player.id;

    // 确定应该使用的视角
    const targetPerspective = nearbyCount > CONFIG.nearbyEntityThreshold ?
        CONFIG.perspective1 : CONFIG.perspective2;

    // 获取玩家当前的视角状态
    const currentPerspective = playerPerspectives.get(playerId);

    // 如果视角没有变化，则不执行操作
    if (currentPerspective === targetPerspective) {
        return;
    }

    // 更新视角状态
    playerPerspectives.set(playerId, targetPerspective);

    // 设置新视角
    if (setPlayerCamera(player, targetPerspective)) {
        console.log(`玩家 ${player.name} 视角切换: 附近 ${nearbyCount} 个实体, 使用 ${targetPerspective} 视角`);
    }
}

// 检查所有玩家的视角
function checkAllPlayersPerspectives() {
    const allPlayers = world.getPlayers();

    for (const player of allPlayers) {
        checkAndSwitchPlayerPerspective(player);
    }
}

// 玩家加入时初始化视角
world.afterEvents.playerJoin.subscribe((event) => {
    const player = event.player;

    // 延迟一小段时间再检查，确保玩家完全加载
    system.runTimeout(() => {
        checkAndSwitchPlayerPerspective(player);
    }, 10);
});

// 玩家移动时检查视角（可选，增加响应性）
world.afterEvents.playerSpawn.subscribe((event) => {
    // 玩家重生时也检查
    if (event.initialSpawn) {
        const player = event.player;
        system.runTimeout(() => {
            checkAndSwitchPlayerPerspective(player);
        }, 10);
    }
});

// 定时检查所有玩家的视角
system.runInterval(() => {
    checkAllPlayersPerspectives();
}, CONFIG.checkInterval);

// 初始化时设置所有玩家的视角
system.run(() => {
    const initialPlayers = world.getPlayers();

    for (const player of initialPlayers) {
        checkAndSwitchPlayerPerspective(player);
    }

    console.log(`相机视角脚本初始化完成！基于附近实体数量切换视角`);
});

// 可选调试命令
world.beforeEvents.chatSend.subscribe((event) => {
    const message = event.message.toLowerCase();
    const player = event.sender;

    if (message === "!p1") {
        event.cancel = true;
        if (setPlayerCamera(player, CONFIG.perspective1)) {
            playerPerspectives.set(player.id, CONFIG.perspective1);
            player.sendMessage(`已手动切换到视角1: ${CONFIG.perspective1}`);
        }
    } else if (message === "!p2") {
        event.cancel = true;
        if (setPlayerCamera(player, CONFIG.perspective2)) {
            playerPerspectives.set(player.id, CONFIG.perspective2);
            player.sendMessage(`已手动切换到视角2: ${CONFIG.perspective2}`);
        }
    } else if (message === "!camstatus") {
        event.cancel = true;
        const nearbyCount = getNearbyEntityCount(player);
        const currentPerspective = playerPerspectives.get(player.id) || "未知";
        player.sendMessage(`附近实体: ${nearbyCount}, 当前视角: ${currentPerspective}, 阈值: ${CONFIG.nearbyEntityThreshold}`);
    } else if (message === "!camreset") {
        event.cancel = true;
        checkAndSwitchPlayerPerspective(player);
        player.sendMessage(`已根据附近实体数量重置视角`);
    } else if (message === "!camradius") {
        event.cancel = true;
        player.sendMessage(`检测半径: ${CONFIG.searchRadius} 格`);
    }
});