// 调试脚本 - 在浏览器控制台运行
console.log('=== 按钮调试信息 ===');

const quickStartBtn = document.getElementById('quick-start-btn');
const browseExamplesBtn = document.getElementById('browse-examples-btn');
const importNovelBtn = document.getElementById('import-novel-btn');

console.log('快速开始按钮:', quickStartBtn);
console.log('浏览示例按钮:', browseExamplesBtn);
console.log('导入小说按钮:', importNovelBtn);

if (quickStartBtn) {
    const rect = quickStartBtn.getBoundingClientRect();
    console.log('快速开始按钮位置:', rect);
    console.log('快速开始按钮样式:', window.getComputedStyle(quickStartBtn));

    // 检查是否有元素覆盖
    const elementAtPoint = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
    console.log('按钮中心位置的元素:', elementAtPoint);
    console.log('是否是按钮本身:', elementAtPoint === quickStartBtn);
}

// 手动测试点击
console.log('\n尝试手动触发点击事件...');
if (quickStartBtn) {
    quickStartBtn.addEventListener('click', () => {
        console.log('✅ 快速开始按钮点击事件触发！');
    });
    quickStartBtn.click();
}
