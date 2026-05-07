class VisualDirector {
    buildStyleBoardPrompt(project) {
        const style = project.visualBible?.styleProfile || {};
        const themeText = Array.isArray(style.themes) && style.themes.length
            ? style.themes.join('、')
            : '叙事向';

        return [
            '视觉风格基准板',
            `作品名：${project.title || '未命名项目'}`,
            `氛围：${style.atmosphere || '待确认'}`,
            `主题：${themeText}`,
            `风格预设：${style.stylePreset || 'cinematic_cn_rpg'}`,
            '要求：输出统一色调、光影方向、材质参考、镜头语言，不含文字水印'
        ].join('，');
    }

    buildCharacterBasePrompt(project, character) {
        const style = project.visualBible?.styleProfile || {};
        const themeText = Array.isArray(style.themes) && style.themes.length
            ? style.themes.join('、')
            : '叙事向';

        return [
            '角色设定图',
            `角色名：${character.name}`,
            `角色定位：${character.role || '待定角色'}`,
            `角色描述：${character.description || '待补充'}`,
            `画面氛围：${style.atmosphere || '待确认'}`,
            `主题风格：${themeText}`,
            '要求：统一画风、半身像、细节清晰、无文字水印'
        ].join('，');
    }

    buildLocationBasePrompt(project, location) {
        const style = project.visualBible?.styleProfile || {};
        const themeText = Array.isArray(style.themes) && style.themes.length
            ? style.themes.join('、')
            : '叙事向';

        return [
            '场景设定图',
            `地点名：${location.name}`,
            `地点描述：${location.description || '待补充'}`,
            `画面氛围：${style.atmosphere || '待确认'}`,
            `主题风格：${themeText}`,
            '要求：统一画风、宽景构图、空间关系清晰、无文字水印'
        ].join('，');
    }

    buildRuntimeScenePrompt(project, visualState = {}) {
        const style = project.visualBible?.styleProfile || {};
        return [
            '剧情运行时场景图',
            `地点：${visualState.location || '未知地点'}`,
            `时间：${visualState.timeOfDay || '未知时间'}`,
            `天气：${visualState.weather || '未知天气'}`,
            `情绪：${visualState.mood || '平静'}`,
            `镜头：${visualState.camera || '中景'}`,
            Array.isArray(visualState.onStageCharacters) && visualState.onStageCharacters.length
                ? `登场角色：${visualState.onStageCharacters.join('、')}`
                : '',
            `风格约束：${style.stylePreset || 'cinematic_cn_rpg'}`,
            '要求：继承角色和地点基准图，不要风格漂移'
        ].filter(Boolean).join('，');
    }

    buildSeedBundle(project) {
        const base = this.hashString(
            `${project.id || ''}|${project.title || ''}|${project.visualBible?.styleProfile?.stylePreset || ''}`
        );
        return {
            styleSeed: base,
            characterSeed: base + 101,
            locationSeed: base + 211,
            runtimeSeed: base + 307
        };
    }

    hashString(text = '') {
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash % 1000000000);
    }
}

module.exports = VisualDirector;
