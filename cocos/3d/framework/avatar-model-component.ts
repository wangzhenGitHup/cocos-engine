/****************************************************************************
 Copyright (c) 2017-2019 Xiamen Yaji Software Co., Ltd.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

import { Texture2D } from '../../assets';
import { Filter, PixelFormat } from '../../assets/asset-enum';
import { Vec2 } from '../../core';
import { ccclass, executeInEditMode, executionOrder, menu, property } from '../../core/data/class-decorator';
import { GFXAttributeName, GFXBufferTextureCopy, GFXFormatInfos } from '../../gfx/define';
import { GFXDevice } from '../../gfx/device';
import { Mesh } from '../assets';
import { SkinningModelComponent } from './skinning-model-component';

export interface IAvatarUnit {
    mesh: Mesh | null;
    offset: Vec2;
    albedoMap: Texture2D | null;
    alphaMap: Texture2D | null;
}

/**
 * !#en The Avatar Model Component
 * !#ch 换装模型组件
 */
@ccclass('cc.AvatarModelComponent')
@executionOrder(100)
@executeInEditMode
@menu('Components/AvatarModelComponent')
export class AvatarModelComponent extends SkinningModelComponent {

    @property
    private _combinedTexSize: number = 1024;

    private _combinedTex: Texture2D | null = null;

    private _units: Array<IAvatarUnit | null> = [];

    @property({ override: true, visible: false })
    get mesh (): Mesh | null {
        return this._mesh;
    }

    get units (): Array<IAvatarUnit | null> {
        return this._units;
    }

    constructor () {
        super();
    }

    public onLoad () {
        super.onLoad();

        this._mesh = new Mesh();

        this._combinedTex = new Texture2D();
        this._combinedTex.setFilters(Filter.LINEAR, Filter.LINEAR);
        this.resizeCombiendTexture();
    }

    public update (dt) {
        super.update(dt);
    }

    public onDestroy () {
        if (this._combinedTex) {
            this._combinedTex.destroy();
            this._combinedTex = null;
        }

        if (this._mesh) {
            this._mesh.destroy();
            this._mesh = null;
        }
    }

    public addUnit (unit: IAvatarUnit) {
        this._units.push(unit);
    }

    public clear () {
        if (this._mesh) {
            this._mesh.destroy();
        }
    }

    public combine () {
        const texImages: TexImageSource[] = [];
        const texImageRegions: GFXBufferTextureCopy[] = [];
        const texBuffers: ArrayBuffer[] = [];
        const texBufferRegions: GFXBufferTextureCopy[] = [];
        let uvOffset = 0;
        let dataView: DataView;
        let uv_x: number;
        let uv_y: number;
        const isLittleEndian = cc.sys.isLittleEndian;

        for (const unit of this._units) {
            if (unit) {
                const offset = unit.offset;
                const isValid = (offset.x >= 0 && offset.y >= 0);
                if (isValid && unit.albedoMap && unit.albedoMap.image && unit.albedoMap.image.data) {

                    // merge textures
                    if (unit.mesh && unit.mesh.data) {
                        dataView = new DataView(unit.mesh.data);
                        const struct = unit.mesh.struct;
                        for (const bundle of struct.vertexBundles) {
                            uvOffset = bundle.view.offset;
                            for (const attr of bundle.attributes) {
                                if (attr.name.indexOf(GFXAttributeName.ATTR_TEX_COORD) >= 0) {
                                    break;
                                }
                                uvOffset += GFXFormatInfos[attr.format].size;
                            }
                            for (let v = 0; v < bundle.view.count; ++v) {
                                uv_x = dataView.getFloat32(uvOffset, isLittleEndian) + offset.x;
                                uv_y = dataView.getFloat32(uvOffset + 4, isLittleEndian) + offset.y;
                                dataView.setFloat32(uvOffset, uv_x, isLittleEndian);
                                dataView.setFloat32(uvOffset + 4, uv_y, isLittleEndian);
                                uvOffset += bundle.view.stride;
                            }
                        }

                        this._mesh!.merge(unit.mesh);
                    }

                    // merge textures
                    const region = new GFXBufferTextureCopy();
                    region.texOffset.x = offset.x;
                    region.texOffset.y = offset.y;
                    region.texExtent.width = unit.albedoMap.image.width;
                    region.texExtent.height = unit.albedoMap.image.height;

                    const data = unit.albedoMap.image.data;
                    if (data instanceof HTMLCanvasElement || data instanceof HTMLImageElement) {
                        texImages.push(data);
                        texImageRegions.push(region);
                    } else {
                        texBuffers.push(data.buffer);
                        texBufferRegions.push(region);
                    }
                }
            }
        }

        const gfxTex = this._combinedTex!.getGFXTexture();
        const device: GFXDevice = cc.director.root.device;

        if (texBuffers.length > 0) {
            device.copyTexImagesToTexture(texImages, gfxTex!, texImageRegions);
        }

        if (texBuffers.length > 0) {
            device.copyBuffersToTexture(texBuffers, gfxTex!, texBufferRegions);
        }
    }

    private resizeCombiendTexture () {
        if (this._combinedTex) {
            this._combinedTex.destroy();
            this._combinedTex.create(this._combinedTexSize, this._combinedTexSize, PixelFormat.RGBA8888);
        }
    }
}