/**
 * 示例游戏模板
 * 提供预设的完整游戏示例，让用户快速体验
 */

const exampleGames = {
    magicAcademy: {
        id: 'example_magic_academy',
        name: '魔法学院',
        type: 'fantasy',
        description: '在神秘的魔法学院中学习魔法，结交朋友，探索秘密',
        difficulty: 'normal',
        worldview: {
            name: '艾瑟利亚魔法学院',
            description: '一所历史悠久的魔法学院，培养了无数伟大的魔法师。学院分为四个学院：火焰院、冰霜院、自然院和奥术院。',
            setting: '奇幻世界',
            rules: [
                '学生必须通过考试才能晋升',
                '禁止在校园内使用黑魔法',
                '每个学生都有一个魔法导师',
                '学院图书馆藏有古老的魔法书'
            ],
            locations: [
                { name: '大礼堂', description: '举行开学典礼和重要仪式的地方' },
                { name: '魔法教室', description: '学习各种魔法的地方' },
                { name: '图书馆', description: '藏有大量魔法书籍和古老卷轴' },
                { name: '练习场', description: '学生练习魔法的场所' },
                { name: '禁林', description: '学院后方的神秘森林，据说藏有秘密' }
            ]
        },
        characters: [
            {
                id: 'char_merlin',
                name: '梅林教授',
                role: '院长',
                description: '睿智而神秘的老魔法师，学院的创始人之一',
                personality: '严肃但关心学生',
                goals: ['培养优秀的魔法师', '保护学院的秘密'],
                secrets: ['知道禁林深处的秘密'],
                relationship: 0
            },
            {
                id: 'char_luna',
                name: '露娜',
                role: '同学',
                description: '来自冰霜院的天才学生，性格冷静',
                personality: '聪明、独立、有点高傲',
                goals: ['成为最强的冰系魔法师'],
                secrets: ['家族有着不为人知的过去'],
                relationship: 0
            },
            {
                id: 'char_finn',
                name: '芬恩',
                role: '同学',
                description: '火焰院的热血少年，总是充满活力',
                personality: '热情、冲动、忠诚',
                goals: ['保护朋友', '掌握强大的火焰魔法'],
                secrets: ['害怕黑暗'],
                relationship: 0
            }
        ],
        items: [
            {
                id: 'item_wand',
                name: '魔杖',
                type: 'weapon',
                description: '新生的标准魔杖，可以施放基础魔法',
                effects: { 魔力: 5 }
            },
            {
                id: 'item_spellbook',
                name: '魔法书',
                type: 'book',
                description: '记录基础魔法的书籍',
                effects: { 智力: 3 }
            }
        ],
        chapters: [
            {
                id: 'chapter_1',
                title: '入学典礼',
                description: '你来到了艾瑟利亚魔法学院，参加入学典礼',
                goal: '完成分院仪式，选择你的学院',
                scenes: ['开学典礼', '分院仪式', '宿舍安顿']
            },
            {
                id: 'chapter_2',
                title: '第一堂课',
                description: '开始你的魔法学习之旅',
                goal: '学会第一个魔法',
                scenes: ['魔法理论课', '实践课', '课后练习']
            },
            {
                id: 'chapter_3',
                title: '禁林探险',
                description: '听说禁林深处有神秘的魔法遗迹',
                goal: '探索禁林，发现秘密',
                scenes: ['夜晚潜入', '遭遇魔法生物', '发现遗迹']
            }
        ],
        openingScene: {
            description: '你站在艾瑟利亚魔法学院的大门前，高耸的塔楼在阳光下闪闪发光。今天是开学典礼，你即将开始你的魔法学习之旅。',
            narration: '欢迎来到艾瑟利亚魔法学院！作为一名新生，你将在这里学习魔法，结交朋友，探索这个充满奇迹的世界。你准备好了吗？',
            startingLocation: '学院大门'
        }
    },

    spaceExplorer: {
        id: 'example_space_explorer',
        name: '星际探险家',
        type: 'scifi',
        description: '驾驶飞船探索未知星系，发现新文明，解决星际危机',
        difficulty: 'normal',
        worldview: {
            name: '银河系第七星区',
            description: '人类已经掌握了星际旅行技术，在银河系中建立了多个殖民地。你是一名独立探险家，驾驶着自己的飞船在星际间冒险。',
            setting: '科幻宇宙',
            rules: [
                '飞船需要定期补充燃料和维修',
                '不同星球有不同的环境和生物',
                '星际贸易是重要的收入来源',
                '某些星区存在海盗和危险'
            ],
            locations: [
                { name: '空间站阿尔法', description: '主要的贸易和补给站' },
                { name: '新地球殖民地', description: '人类最大的殖民星球' },
                { name: '废弃矿场', description: '曾经繁荣的矿场，现已废弃' },
                { name: '未知星球X-7', description: '最近发现的神秘星球' }
            ]
        },
        characters: [
            {
                id: 'char_captain',
                name: '艾娃船长',
                role: '空间站指挥官',
                description: '经验丰富的老船长，管理着阿尔法空间站',
                personality: '严谨、公正、有领导力',
                goals: ['维护空间站秩序', '保护贸易航线'],
                relationship: 0
            },
            {
                id: 'char_scientist',
                name: '陈博士',
                role: '科学家',
                description: '研究外星生物的科学家',
                personality: '好奇、专注、有点古怪',
                goals: ['发现新物种', '解开宇宙之谜'],
                secrets: ['正在进行秘密研究'],
                relationship: 0
            }
        ],
        items: [
            {
                id: 'item_scanner',
                name: '星际扫描仪',
                type: 'tool',
                description: '可以扫描星球和生物的设备',
                effects: { 科技: 5 }
            }
        ],
        chapters: [
            {
                id: 'chapter_1',
                title: '首次任务',
                description: '接受你的第一个探险任务',
                goal: '完成货物运输任务',
                scenes: ['接受任务', '星际航行', '遭遇海盗']
            }
        ],
        openingScene: {
            description: '你的飞船停靠在阿尔法空间站。透过舷窗，你可以看到繁忙的太空港口，各种飞船来来往往。',
            narration: '作为一名独立探险家，你刚刚完成了飞船的维修。现在是时候接受新的任务，开始你的星际冒险了。',
            startingLocation: '阿尔法空间站'
        }
    },

    detectiveAgency: {
        id: 'example_detective',
        name: '侦探事务所',
        type: 'mystery',
        description: '经营一家侦探事务所，调查各种神秘案件',
        difficulty: 'normal',
        worldview: {
            name: '雾都市',
            description: '一座常年笼罩在雾气中的城市，充满了秘密和阴谋。你经营着一家小型侦探事务所。',
            setting: '现代都市',
            rules: [
                '收集线索需要仔细观察',
                '询问证人可能获得重要信息',
                '有些线索需要特殊工具才能发现',
                '推理错误可能导致案件失败'
            ],
            locations: [
                { name: '侦探事务所', description: '你的办公室，堆满了案件档案' },
                { name: '警察局', description: '与警方合作的地方' },
                { name: '图书馆', description: '查阅资料的好地方' },
                { name: '码头区', description: '城市的灰色地带' }
            ]
        },
        characters: [
            {
                id: 'char_inspector',
                name: '李警官',
                role: '警察',
                description: '正直的警察，经常与你合作',
                personality: '认真、正义、有点固执',
                goals: ['维护法律', '破获案件'],
                relationship: 10
            },
            {
                id: 'char_assistant',
                name: '小林',
                role: '助手',
                description: '你的得力助手，擅长信息收集',
                personality: '机灵、细心、忠诚',
                goals: ['协助你破案', '学习侦探技巧'],
                relationship: 20
            }
        ],
        items: [
            {
                id: 'item_magnifier',
                name: '放大镜',
                type: 'tool',
                description: '侦探的必备工具',
                effects: { 观察力: 5 }
            }
        ],
        chapters: [
            {
                id: 'chapter_1',
                title: '失踪的画家',
                description: '一位著名画家神秘失踪',
                goal: '找到画家的下落',
                scenes: ['接受委托', '调查画室', '追踪线索']
            }
        ],
        openingScene: {
            description: '雨水敲打着事务所的窗户。你坐在办公桌前，翻阅着报纸上的新闻。突然，门被推开了。',
            narration: '一位焦急的女士走进你的事务所，她的丈夫——一位著名画家失踪了。这看起来是一个有趣的案子。',
            startingLocation: '侦探事务所'
        }
    }
};

/**
 * 获取所有示例游戏列表
 */
function getExampleGamesList() {
    return Object.keys(exampleGames).map(key => {
        const game = exampleGames[key];
        return {
            id: game.id,
            name: game.name,
            type: game.type,
            description: game.description,
            difficulty: game.difficulty
        };
    });
}

/**
 * 获取示例游戏详情
 */
function getExampleGame(gameId) {
    const key = Object.keys(exampleGames).find(k => exampleGames[k].id === gameId);
    return key ? exampleGames[key] : null;
}

module.exports = {
    exampleGames,
    getExampleGamesList,
    getExampleGame
};
