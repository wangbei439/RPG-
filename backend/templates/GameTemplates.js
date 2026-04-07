const GameTemplates = {
    getTemplate(type) {
        return this.templates[type] || this.templates.custom;
    },

    templates: {
        adventure: {
            name: '冒险RPG',
            characterCount: 6,
            description: '经典冒险RPG，包含探索、战斗、任务和解谜元素',
            features: ['开放世界探索', '多分支剧情', '角色成长系统', '装备收集'],
            stats: ['生命值', '攻击力', '防御力', '敏捷', '幸运'],
            mechanics: ['回合制战斗', '探索发现', '任务系统', '对话选择']
        },
        dungeon: {
            name: '地牢探索',
            characterCount: 4,
            description: '深入地牢，面对危险，寻找宝藏',
            features: ['程序化地牢生成', '资源管理', '永久死亡风险', '宝藏收集'],
            stats: ['生命值', '饥饿度', '攻击力', '防御力', '幸运'],
            mechanics: ['房间探索', '陷阱检测', '战斗遭遇', '物品管理']
        },
        romance: {
            name: '恋爱模拟',
            characterCount: 5,
            description: '与多个角色发展浪漫关系',
            features: ['多角色攻略', '好感度系统', '约会事件', '多结局'],
            stats: ['魅力', '智力', '情感', '体力', '金钱'],
            mechanics: ['对话选择', '约会系统', '礼物赠送', '事件触发']
        },
        mystery: {
            name: '推理探案',
            characterCount: 8,
            description: '收集线索，推理真相',
            features: ['线索收集', '嫌疑人审问', '逻辑推理', '真相揭露'],
            stats: ['观察力', '推理力', '体力', '人脉', '信誉'],
            mechanics: ['线索板', '人物关系图', '推理对决', '时间线重建']
        },
        fantasy: {
            name: '奇幻魔法',
            characterCount: 6,
            description: '魔法世界，学习法术，对抗邪恶',
            features: ['魔法学习系统', '元素相克', '法术组合', '魔法生物'],
            stats: ['生命值', '魔力值', '智力', '精神', '元素亲和'],
            mechanics: ['魔法战斗', '法术研究', '魔法生物驯服', '元素探索']
        },
        scifi: {
            name: '科幻星际',
            characterCount: 5,
            description: '星际旅行，探索外星文明',
            features: ['星际航行', '外星种族', '科技研发', '太空战斗'],
            stats: ['生命值', '能量', '科技', '外交', '指挥'],
            mechanics: ['飞船管理', '星球探索', '科技树', '外交谈判']
        },
        survival: {
            name: '生存挑战',
            characterCount: 3,
            description: '在恶劣环境中求生',
            features: ['资源收集', '基地建设', '天气系统', '野生动物'],
            stats: ['生命值', '饥饿度', '口渴度', '体力', '精神'],
            mechanics: ['采集狩猎', '工具制作', '庇护所建设', '日夜循环']
        },
        kingdom: {
            name: '王国建设',
            characterCount: 7,
            description: '管理王国，做出影响国家命运的决策',
            features: ['国家管理', '决策系统', '大臣互动', '外交关系'],
            stats: ['威望', '财政', '军事', '民心', '外交'],
            mechanics: ['朝会决策', '大臣建议', '事件处理', '国家发展']
        },
        cultivation: {
            name: '修仙问道',
            characterCount: 6,
            description: '修炼成仙，探索道法',
            features: ['境界系统', '功法修炼', '法宝收集', '天劫考验'],
            stats: ['生命值', '灵力', '修为', '根骨', '悟性'],
            mechanics: ['打坐修炼', '功法参悟', '法宝炼制', '渡劫飞升']
        },
        custom: {
            name: '自定义RPG',
            characterCount: 5,
            description: '完全自定义的RPG体验',
            features: ['自定义世界观', '自由角色创建', '开放剧情', '灵活系统'],
            stats: ['生命值', '攻击力', '防御力', '敏捷', '智力'],
            mechanics: ['自由探索', '对话互动', '任务系统', '角色成长']
        }
    }
};

module.exports = GameTemplates;
