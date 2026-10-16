# cursor-pet

跟着本机 Cursor Agent 换动作的透明桌宠。你发话它在思考，cursor改文件时在干活，做完或出错会更换姿势。

目前只支持 **Windows**。需要已经装好 Node.js，并且本机登录着 Cursor。

## 跑起来

```powershell
git clone https://github.com/Reverie-t/cursor-pet.git
cd cursor-pet
npm install
npm run install-hooks
npm start
```

`npm run install-hooks` 把信号写进你用户目录下的 Cursor 钩子。装完如果桌宠还不动，重开一次 Cursor。

关掉窗口后，下次本机 Agent 开始干活时它会自己再打开。也可以再执行一次 `npm start`。

## 右键菜单

- 今天 Agent 实际在想、在干活的时间，以及成功、失败次数
- 上次记下的套餐余额。点「刷新余额」才会再问 Cursor
- 跟它说一句。这句话在本机回答，不花套餐额度
- 回到右下角
- 退出

额度默认用到 80% 提醒一次，95% 和 100% 再各提醒一次，同一档一天只说一遍。要改门槛，在
 `logs/pet-settings.json` 里写：

```json
{ "alertPercent": 70 }
```

## 许可

代码以 [MIT](LICENSE) 许可发布，署名 reverie。
